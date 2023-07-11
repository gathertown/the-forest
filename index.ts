import { API_KEY } from "./api-key";
import { Game, WireObject } from "@gathertown/gather-game-client";
global.WebSocket = require("isomorphic-ws");

// replace with your spaceId, that you can edit
const SPACE_ID = "e5kK4mRdSOALriFT\\TheForest";
const N = 150;
const MAP_ID = "forest-v1";
const REGROW_PROB = 0.05;
const REGROW_MS = 5000;
const INNER_RADIUS = 25;
const OUTER_RADIUS = 600;

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
  "https://cdn.gather.town/storage.googleapis.com/gather-town.appspot.com/uploads/SWaZgxCQMTE6C1lq/DNDUXum2k4MTp0TLFxacut";
const BLANK =
  "https://cdn.gather.town/v0/b/gather-town-dev.appspot.com/o/objects%2Fblank.png?alt=media&token=6564fd34-433a-4e08-843a-5c4b50d6f9e5";

// setup

const game = new Game(SPACE_ID, () => Promise.resolve({ apiKey: API_KEY }));
game.connect();
game.subscribeToConnection((connected) => console.log("connected?", connected));

// utils

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomTree = (): { normal: string; highlighted: string } => {
  return Math.random() < 0.75 ? redTree : greenTree;
};

// tracks whether the location should have a tree or not
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
// update 7/11/23: not sure if this is in a working state anymore
const cleanSlate = async () => {
  await game.waitForInit();

  console.log("resetting", MAP_ID);

  game.sendAction({
    $case: "mapSetDimensions",
    mapSetDimensions: {
      mapId: MAP_ID,
      width: N,
      height: N,
    },
  });
  game.sendAction({
    $case: "mapSetBackgroundImagePath",
    mapSetBackgroundImagePath: {
      mapId: MAP_ID,
      backgroundImagePath: background,
    },
  });
  game.sendAction({
    $case: "mapSetSpawns",
    mapSetSpawns: {
      mapId: MAP_ID,
      spawns: [{ x: N / 2, y: N / 2 - 1 }],
    },
  });
  // generate trees and impassable tiles
  const impassableAsBytes = [];

  for (let r = 0; r < N; r++) {
    // important that rows are first here, so they're drawn in the right order
    for (let c = 0; c < N; c++) {
      const shouldHaveTree = locationToId[`${c},${r}`];
      impassableAsBytes.push(shouldHaveTree === undefined ? 0x00 : 0x01);

      if (shouldHaveTree !== undefined) {
        const treeImages = randomTree();
        game.addObject(MAP_ID, {
          height: 2,
          width: 1,
          distThreshold: 1,
          x: c,
          y: r - 1,
          type: 5,
          previewMessage: "press x to chop",
          normal: treeImages.normal,
          highlighted: treeImages.highlighted,
          customState: "tree",
          _tags: [], // smh we're going to hopefully get rid of this soon but for now you just have to include it with setObject actions, sorry
        });
        await sleep(50);
      }
    }
  }

  game.sendAction({
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
};

// ********* main process *****************

const runForest = () => {
  game.subscribeToEvent(
    "playerInteractsWithObject",
    ({ playerInteractsWithObject: { key } }, _context) => {
      console.log(`tree ${key} chopped!`);

      game.sendAction({
        $case: "mapUpdateObjects",
        mapUpdateObjects: {
          mapId: MAP_ID,
          objects: {
            [key]: {
              type: 0,
              normal: BLANK,
              customState: "hole",
              _tags: [], // smh we're going to hopefully get rid of this soon but for now you just have to include it with setObject actions, sorry
            },
          },
        },
      });
      // need to get the tree's location from the map object
      const { x, y } = game.partialMaps[MAP_ID].objects?.[key]!; // the ! tells TS that I'm certain this tree exists. slightly unsafe but cleaner
      game.setImpassable(MAP_ID, x, y + 1, false); // +1 because the y is the top of the tree, and positive y is down
    },
  );

  // set up an interval to regrow stuff every N seconds
  setInterval(() => {
    console.log("doing regrowth");
    // regrowth:
    // grow vines into trees, always
    // randomly place vines on empty tiles

    // first loop through and find where the vines and holes are
    const vines = [];
    const holes = [];
    for (const key in game.partialMaps[MAP_ID].objects) {
      const obj = game.partialMaps[MAP_ID]?.objects?.[key];
      if (!obj) {
        console.error("unexpected missing tree??", key);
        continue;
      }
      if (obj.customState === "hole") {
        holes.push(key);
      }
      if (obj.customState === "vine") {
        vines.push(key);
      }
    }

    const objectUpdates: { [key: string]: WireObject } = {};
    // grow the vines
    vines.forEach((key) => {
      const tree = randomTree();
      // make it a tree again
      objectUpdates[key] = {
        type: 5,
        normal: tree.normal,
        highlighted: tree.highlighted,
        customState: "tree",
        _tags: [], // smh we're going to hopefully get rid of this soon but for now you just have to include it with setObject actions, sorry
      };
      // make this tile impassable again too
      const { x, y } = game.partialMaps[MAP_ID].objects?.[key]!; // the ! tells TS that I'm certain this tree exists. slightly unsafe but cleaner
      game.setImpassable(MAP_ID, x, y + 1, true); // +1 because the y is the top of the tree, and positive y is down
    });
    // maybe grow the holes
    holes.forEach((key) => {
      if (Math.random() < REGROW_PROB) {
        objectUpdates[key] = {
          normal: vineSrc,
          customState: "vine",
          _tags: [], // smh we're going to hopefully get rid of this soon but for now you just have to include it with setObject actions, sorry
        };
      }
    });

    // send obj updates
    game.sendAction({
      $case: "mapUpdateObjects",
      mapUpdateObjects: {
        mapId: MAP_ID,
        objects: objectUpdates,
      },
    });
  }, REGROW_MS);
};

//

// main function call

// cleanSlate(); // first time map setup
runForest(); // actually running it
