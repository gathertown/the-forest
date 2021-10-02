const { API_KEY } = require("./api-key");
const { Game } = require("@gathertown/gather-game-client");
global.WebSocket = require("isomorphic-ws");

const ROOM_ID = "e5kK4mRdSOALriFT\\TheForest";
const N = 150;
const MAP_ID = "forest-v1";
const REGROW_PROB = 0.1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let holes = {}; // missing trees. keyed by [x,y] cast to string

// images used
const greenTree = {
	normal:
		"https://firebasestorage.googleapis.com/v0/b/gather-town.appspot.com/o/manually-uploaded%2Ftree-green.png?alt=media&token=b92b7d03-1f03-40f9-88f5-8dc683b6590e",
	highlighted:
		"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/assets%2Fe931d0ec-5126-4a62-bca4-3c6af1385c0f?alt=media&token=daf4c0ce-8545-4905-a64c-881700b1d981",
};
const redTree = {
	normal:
		"https://firebasestorage.googleapis.com/v0/b/gather-town.appspot.com/o/manually-uploaded%2Ftree-red.png?alt=media&token=5e44e76f-2922-4617-9e6b-13e7d6857a53",
	highlighted:
		"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/assets%2Feedf4d2d-ff6e-42ee-a003-028e94074045?alt=media&token=759836f8-da17-49a9-b4ea-b71c2ae35ba5",
};
const vineSrc =
	"https://firebasestorage.googleapis.com/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fvines.png?alt=media&token=1b82621d-9428-4f03-bf1e-833447dde06f";

const writeMap = async () => {
	let trees = [];
	let assets = [];

	// collisions
	let collBytes = [];
	for (let r = 0; r < N; r++) {
		for (let c = 0; c < N; c++) {
			const middleCircle =
				(N / 2 - r) * (N / 2 - r) + (N / 2 - c) * (N / 2 - c) < 25 ||
				(N / 2 - r) * (N / 2 - r) + (N / 2 - c) * (N / 2 - c) > 200; // more than 500 makes the request too large :(
			// impassable[[r, c]] && impassable[[r, c]].imp ? 0x01 : 0x00
			collBytes.push(middleCircle || holes[[c, r]] ? 0x00 : 0x01);
			// add tree if no hole
			if (!middleCircle && !holes[[c, r]]) {
				const color = // randomly assign red/green
					(7 * (c * c * c + r * r + 5 * c) + r * c * 2) % 9 < 1
						? redTree
						: greenTree;
				trees.push({
					scale: 1,
					height: 2,
					width: 1,
					distThreshold: 1,
					x: c,
					y: r - 1,
					type: 1,
					properties: {
						url: `${
							IS_PROD
								? "https://forest-001.gather.town"
								: "http://localhost:3333"
						}/chopTree?x=${c}&y=${r}`,
					},
					previewMessage: "double tap x to chop",
					...color,
				});
			}
			if (holes[[c, r]]?.growing) {
				// about to regrow -- put vines
				assets.push({
					width: 1,
					height: 1,
					x: c,
					y: r,
					src: vineSrc,
					inFront: false,
				});
			}
		}
	}

	let map = {
		backgroundImagePath:
			"https://firebasestorage.googleapis.com/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fforest-v1.png?alt=media&token=23f570f6-e15d-40a3-b44c-d4359334bba3",
		spawns: [{ x: N / 2, y: N / 2 }],
		id: MAP_ID,
		dimensions: [N, N],
		// objectSizes
		objects: trees,
		assets: assets,
		collisions: new Buffer(collBytes).toString("base64"), // base64 encoded array of dimensions[1] x dimensions[0] bytes
		portals: [],
	};
	// await axios.post(
	// 	IS_PROD
	// 		? "https://gather.town/api/setMap"
	// 		: "http://localhost:8080/api/setMap",
	// 	{
	// 		apiKey: API_KEY,
	// 		spaceId: ROOM_ID,
	// 		mapId: MAP_ID,
	// 		mapContent: map,
	// 	}
	// );
};

const regrow = () => {
	Object.values(holes).forEach((hole) => {
		const { x, y } = hole;
		if (
			holes[[x, y + 1]] &&
			holes[[x, y - 1]] &&
			holes[[x + 1, y]] &&
			holes[[x - 1, y]]
		) {
			// if no neighboring trees, nothing can grow. do nothing
			holes[[x, y]].growing = false;
			return;
		}
		// if vines, grow to a tree
		if (hole.growing) {
			delete holes[[x, y]];
			return;
		}
		// if there's a tree adjacent and the randomness checks out, grow vines
		if (Math.random() < REGROW_PROB) {
			holes[[x, y]].growing = true;
		}
	});
	return writeMap();
};

// app.get("/chopTree", (req, res) => {
// 	holes[[req.query.x, req.query.y]] = { ...req.query };
// 	writeMap();
// });

writeMap();

// set up regrow tick
(async () => {
	while (true) {
		await sleep(5000);
		await regrow().catch(console.error);
	}
})();
