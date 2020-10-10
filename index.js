const express = require("express");
const axios = require("axios");

const { ROOM_ID, API_KEY } = require("./config");
const N = 150;
const MAP_ID = "forest-v1";

const app = express();
const port = 3333;

const writeMap = async () => {
	const greenTree =
		"https://firebasestorage.googleapis.com/v0/b/gather-town.appspot.com/o/manually-uploaded%2Ftree-green.png?alt=media&token=b92b7d03-1f03-40f9-88f5-8dc683b6590e";
	const redTree =
		"https://firebasestorage.googleapis.com/v0/b/gather-town.appspot.com/o/manually-uploaded%2Ftree-red.png?alt=media&token=5e44e76f-2922-4617-9e6b-13e7d6857a53";

	let trees = [
		{
			scale: 1,
			height: 2,
			width: 1,
			type: 1,
			distThreshold: 1,
			x: N / 2 + 2,
			y: N / 2 + 2,
			normal: greenTree,
			properties: {
				url: "https://gather.town",
			},
			previewMessage: "press x to chop",
		},
	];

	// collisions
	let collBytes = [];
	for (let r = 0; r < N; r++) {
		for (let c = 0; c < N; c++) {
			// impassable[[r, c]] && impassable[[r, c]].imp ? 0x01 : 0x00
			collBytes.push(
				(N / 2 - r) * (N / 2 - r) + (N / 2 - c) * (N / 2 - c) > 24 ? 0x01 : 0x00
			);
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
		collisions: new Buffer(collBytes).toString("base64"), // base64 encoded array of dimensions[1] x dimensions[0] bytes
		portals: [],
	};
	// await axios.post("http://localhost:8080/api/setMap", {
	await axios.post("https://gather.town/api/setMap", {
		apiKey: API_KEY,
		spaceId: ROOM_ID,
		mapId: MAP_ID,
		mapContent: map,
	});
};

app.get("/", (req, res) => {
	res.send("Hello World!");
});

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});

writeMap();
