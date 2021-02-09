# axios cache adapter

a simple cache adapter for axios to cache GET requests in mongodb with a TTL index on the collection (the collection will be created with the index if it doesn't already exist)

currently matches records on method, url, data, and params

# usage

```
const axios = require('axios');
const createCache = require('axios-cache-mongodb');

// create a mongodb client and connect
...
const db = client.db(/** db name */);

const axiosCached = axios.create({
  adapter: createCache({
    db: db,
    collectionName: 'axios-cache',
    expireAfterSeconds: 3600
  })
});

axiosCached.get('https://example.com/query?id=1234');
```
