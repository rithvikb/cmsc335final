let http = require("http");
let path = require("path");
let express = require("express");
let portNum = process.argv[2]
let app = express();
let bodyParser = require("body-parser");

let url = "http://localhost:" + portNum;

require("dotenv").config({ path: path.resolve(__dirname, '.env') }) 

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const m_db = process.env.MONGO_DB_NAME;
const m_collection = process.env.MONGO_COLLECTION;

const uri = `mongodb+srv://${userName}:${password}@cluster0.kfwwn.mongodb.net/CMSC335_DB?retryWrites=true&w=majority`;
 
const {MongoClient} = require('mongodb');
const client = new MongoClient(uri);

 /* Our database and collection */
const databaseAndCollection = {db: m_db, collection: m_collection};

async function insertApplication(client, databaseAndCollection, newApp) {
    try {
        await client.connect();
        const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newApp);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookUpApplication(client, databaseAndCollection, appEmail) {
    let result;
    try {
        await client.connect();
        let filter = {email: appEmail};
        result = await client.db(databaseAndCollection.db)
                            .collection(databaseAndCollection.collection)
                            .findOne(filter);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
        return result;
    } 
}

async function lookUpByGPA(client, databaseAndCollection, minGPA) {
    let cursor;
    let result;
    try {
        await client.connect();
        let filter = {gpa : { $gte: minGPA}};
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

async function clearApplications(client, databaseAndCollection) {
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


app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(bodyParser.urlencoded({extended:false}));

app.get("/", function(request, response) {
response.render("index");
});

app.get("/apply", function(request, response) {
    response.render("apply");
});

app.post("/processApplication", async (request, response) => {
    let application = {
        name: request.body.name,
        email: request.body.email,
        gpa: request.body.gpa,
        background: request.body.backgroundInfo
    };   

    await insertApplication(client, databaseAndCollection, application);

    application.time = Date();
    response.render("processApplication", application);
});

app.get("/adminGFA", function(request, response) {
    response.render("adminGFA");
});


app.post("/processAdminGFA", async (request, response) => {
    let minGPA = request.body.gpa;
      
    result = await lookUpByGPA(client, databaseAndCollection, minGPA);
    let variables = {
        tableElements: ""
    }
    result.forEach(function(application) {
        variables.tableElements += "\t<tr><td>";
        variables.tableElements += application.name;
        variables.tableElements += "</td><td>"
        variables.tableElements += application.gpa;
        variables.tableElements += "</td></tr>\n";
    })
    response.render("processAdminGFA", variables);
});

app.get("/reviewApplication", function(request, response) {
    response.render("reviewApplication");
});

app.post("/processReviewApplication", async (request, response) => {
    let email = request.body.email;
      
    result = await lookUpApplication(client, databaseAndCollection, email);
    let variables;
    if(result) {
        variables = {
            name: result.name,
            email: result.email,
            gpa: result.gpa,
            background: result.background,
            time: Date()
        }; 
    } else {
        variables = {
            name: "NONE",
            email: "NONE",
            gpa: "NONE",
            background: "NONE",
            time: Date()
        }
    }
    response.render("processReviewApplication", variables);
});

app.get("/adminRemove", function(request, response) {
    response.render("adminRemove");
});

app.post("/processAdminRemove", async (request, response) => {
    let variables = {
        numRemoved: await clearApplications(client, databaseAndCollection)
    };
    response.render("processAdminRemove", variables);
});

// CLI Program
process.stdin.setEncoding("utf8");

console.log("Web server started and running at " + url);
http.createServer(app).listen(portNum);

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