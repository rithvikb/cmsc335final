let http = require("http");
let path = require("path");
let express = require("express");
let app = express();
let bodyParser = require("body-parser");
let axios = require("axios");

const port = 5001;
let url = "http://localhost:5001";

require("dotenv").config({ path: path.resolve(__dirname, '.env') }) 

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const m_db = process.env.MONGO_DB_NAME;
const m_collection = process.env.MONGO_COLLECTION;

const uri = `mongodb+srv://${userName}:${password}@cluster0.kfwwn.mongodb.net/CMSC335_DB?retryWrites=true&w=majority`;
 
const {MongoClient} = require('mongodb');
const { response } = require("express");
const client = new MongoClient(uri);

 /* Our database and collection */
const databaseAndCollection = {db: m_db, collection: m_collection};

async function insertPokemon(client, databaseAndCollection, newPokemon) {
    try {
        await client.connect();
        const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newPokemon);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookUpByOwner(client, databaseAndCollection, user) {
    let cursor;
    let result;
    try {
        await client.connect();
        let filter = {owner : { $eq: user}};
        cursor = client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find(filter);
        result = await cursor.toArray();
    } catch (e) {
        console.error(e);
    } finally {
        await client.close()
        return result;
    }
}

async function clearPokemon(client, databaseAndCollection) {
    let deletedNum;
    try {
        await client.connect();
        const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .deleteMany({});
        deletedNum = result.deletedCount;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
        return deletedNum;
    }
}

async function getPokemonImg(pokemon) {
    let response = "";
    await axios
        .get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
        .then(res => {
            response = res.data.sprites.front_default;
            //console.log(res);
        })
        .catch(error => {
        console.error(error);
        });
    return response;
}

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(bodyParser.urlencoded({extended:false}));

app.get("/", function(request, response) {
response.render("index");
});

app.get("/addPokemon", function(request, response) {
    response.render("addPokemon");
});

app.post("/processAddPokemon", async (request, response) => {
    let pokemonEntry = {
        owner: request.body.name,
        pokemon: request.body.pokemon,
    };   

    await insertPokemon(client, databaseAndCollection, pokemonEntry);

    response.render("addPokemon");
});

app.get("/getTrainer", function(request, response) {
    response.render("getTrainer");
});


app.post("/processGetTrainer", async (request, response) => {
    let user = request.body.trainer;
      
    result = await lookUpByOwner(client, databaseAndCollection, user);
    let variables = {
        user: request.body.trainer,
        pokeTable: ""
    }

    for (let i = 0; i < result.length; i++) {
        variables.pokeTable += "\t<tr><td>";
        variables.pokeTable += result[i].pokemon;
        variables.pokeTable += "</td><td>";
        let imgUrl = await getPokemonImg(result[i].pokemon);
        variables.pokeTable += "<img src=";
        variables.pokeTable += imgUrl;
        variables.pokeTable += ">"
        variables.pokeTable += "</td></tr>\n";

    }
    response.render("display", variables);
});

app.get("/clearDatabase", function(request, response) {
    response.render("clearDatabase");
});

app.post("/processClearDatabase", async (request, response) => {
    let variables = {
        numRemoved: await clearPokemon(client, databaseAndCollection)
    };
    response.render("index", variables);
});

// CLI Program
process.stdin.setEncoding("utf8");

console.log("Web server started and running at " + url);
http.createServer(app).listen(port);

process.stdin.on('readable', function() {
    let dataInput = process.stdin.read();
    if (dataInput !== null) {
        let command = dataInput.trim();
        if (command === "stop") {
            console.log("Shutting down the server");
            process.exit(0);
        } else {
            console.log(`Invalid command: ${command}`);
        }
        process.stdin.resume();
    }
});