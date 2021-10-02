# The Forest (v2)

The code behind [The Forest](https://gather.town/app/e5kK4mRdSOALriFT/TheForest), a dynamic, living Gather map.

Also a great example of a mod built with the [Gather API](https://gathertown.notion.site/Gather-Websocket-API-bf2d5d4526db412590c3579c36141063)!

## setup

prereq: have NodeJS and npm installed

run `npm install`

put your API key in a file named `api-key.js` like so:

```js
exports.API_KEY = "your-api-key-here";
```

replace the spaceId in index.ts with your own

## running

`npm run start`
