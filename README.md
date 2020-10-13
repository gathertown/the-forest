# forest-server

## FYI

needs `config.js` in the root dir filled with the following:

```js
module.exports = {
	PROD_ROOM_ID: "YourSpaceId12345\\Space Name", // note the \, NOT / as is in the URL
	DEV_ROOM_ID: "same thing^ but for if you're running gather locally",
	API_KEY: "your-Gather-API-key",
};
```

change `const IS_PROD = true` to `false` in the first line of `index.js` to run locally. you'll also need gather running locally

start it with `node index.js` (long running process)

will need to change that space's starting map to `forest-v1` -- or change the `MAP_ID` in `index.js` to suit your space
