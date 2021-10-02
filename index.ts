import { API_KEY } from "./api-key";
import { Game, WireObject } from "@gathertown/gather-game-client";
global.WebSocket = require("isomorphic-ws");

// const SPACE_ID = "e5kK4mRdSOALriFT\\TheForest";
const SPACE_ID = "oFz81x6yCVKjL5qt\\TheForest";
const N = 150;
const MAP_ID = "forest-v1";
const REGROW_PROB = 0.1;
const REGROW_MS = 5000;
const INNER_RADIUS = 25;
const OUTER_RADIUS = 500;

// images used

const background =
	"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fforest-v1.png?alt=media&token=23f570f6-e15d-40a3-b44c-d4359334bba3";
const greenTree = {
	normal:
		"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Ftree-green.png?alt=media&token=b92b7d03-1f03-40f9-88f5-8dc683b6590e",
	highlighted:
		"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/assets%2Fe931d0ec-5126-4a62-bca4-3c6af1385c0f?alt=media&token=daf4c0ce-8545-4905-a64c-881700b1d981",
};
const redTree = {
	normal:
		"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Ftree-red.png?alt=media&token=5e44e76f-2922-4617-9e6b-13e7d6857a53",
	highlighted:
		"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/assets%2Feedf4d2d-ff6e-42ee-a003-028e94074045?alt=media&token=759836f8-da17-49a9-b4ea-b71c2ae35ba5",
};
const vineSrc =
	"https://cdn.gather.town/v0/b/gather-town.appspot.com/o/manually-uploaded%2Fvines.png?alt=media&token=1b82621d-9428-4f03-bf1e-833447dde06f";
const BLANK =
	"https://cdn.gather.town/v0/b/gather-town-dev.appspot.com/o/objects%2Fblank.png?alt=media&token=6564fd34-433a-4e08-843a-5c4b50d6f9e5";

// setup

const game = new Game(() => Promise.resolve({ apiKey: API_KEY }));
game.debugOverrideServer = "ws://localhost:3000";
game.connect(SPACE_ID); // replace with your spaceId of choice
game.subscribeToConnection((connected) => console.log("connected?", connected));

// utils

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomTree = (): { normal: string; highlighted: string } => {
	return Math.random() < 0.25 ? redTree : greenTree;
};

const locationToId: { [loc: string]: number } = {};
let treeCount = 0;
for (let r = 0; r < N; r++) {
	// important that rows are first here, so they're drawn in the right order
	for (let c = 0; c < N; c++) {
		const noTree =
			(N / 2 - r) * (N / 2 - r) + (N / 2 - c) * (N / 2 - c) < INNER_RADIUS || // inner circle
			(N / 2 - r) * (N / 2 - r) + (N / 2 - c) * (N / 2 - c) > OUTER_RADIUS; // outer circle
		if (!noTree) {
			locationToId[`${c},${r}`] = treeCount;
			treeCount += 1;
		}
	}
}

//

// just for first time setup
const cleanSlate = () => {
	let startedCleanup = false;

	game.subscribeToEvent("mapSetObjects", (data, _context) => {
		// wait for the map of interest to load
		if (data.mapSetObjects.mapId === MAP_ID && !startedCleanup) {
			console.log("resetting", MAP_ID);
			startedCleanup = true; // so more events triggered by stuff in here doesn't make us do it all again

			game.engine.sendAction({
				$case: "mapSetDimensions",
				mapSetDimensions: {
					mapId: MAP_ID,
					width: N,
					height: N,
				},
			});
			game.engine.sendAction({
				$case: "mapSetBackgroundImagePath",
				mapSetBackgroundImagePath: {
					mapId: MAP_ID,
					backgroundImagePath: background,
				},
			});
			game.engine.sendAction({
				$case: "mapSetSpawns",
				mapSetSpawns: {
					mapId: MAP_ID,
					spawns: [{ x: N / 2, y: N / 2 }],
				},
			});
			// generate trees and impassable tiles
			const impassableAsBytes = [];
			const objects: { [key: number]: WireObject } = {};

			for (let r = 0; r < N; r++) {
				// important that rows are first here, so they're drawn in the right order
				for (let c = 0; c < N; c++) {
					const treeId = locationToId[`${c},${r}`];
					impassableAsBytes.push(treeId === undefined ? 0x00 : 0x01);

					if (treeId !== undefined) {
						const treeImages = randomTree();
						objects[treeId] = {
							id: "" + treeId, // typescript wants a string
							height: 2,
							width: 1,
							distThreshold: 1,
							x: c,
							y: r - 1,
							type: 5,
							previewMessage: "press x to chop",
							normal: treeImages.normal,
							highlighted: treeImages.highlighted,
							_tags: [],
						};
					}
				}
			}

			game.engine.sendAction({
				$case: "mapSetCollisions",
				mapSetCollisions: {
					mapId: MAP_ID,
					x: 0,
					y: 0,
					w: N,
					h: N,
					mask: new Buffer(impassableAsBytes).toString("base64"),
				},
			});
			game.engine.sendAction({
				$case: "mapSetObjects",
				mapSetObjects: {
					mapId: MAP_ID,
					objects,
				},
			});
		}
	});
};

const runForest = () => {
	game.subscribeToEvent("playerInteracts", (data, _context) => {
		const treeId = parseInt(data.playerInteracts.objId);
		console.log(`tree ${treeId} chopped!`);

		game.engine.sendAction({
			$case: "mapSetObjects",
			mapSetObjects: {
				mapId: MAP_ID,
				objects: {
					[treeId]: {
						type: 0,
						normal: BLANK,
						_tags: [],
					},
				},
			},
		});
	});

	setInterval(regrow, REGROW_MS);
};

const regrow = () => {};

/*


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


*/

//

// cleanSlate(); // first time map setup
runForest(); // actually running it
