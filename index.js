import docParser from 'docparser-node';
import process from 'dotenv'
import path from 'path';
import { Configuration, OpenAIApi } from 'openai';
import { resourceLimits } from 'worker_threads';

const __dirname = path.dirname('.');
console.log("Working Directory: ", __dirname)
const env = process.config({path: path.resolve('.env')});
console.log(env);

const docParserApiKey = env.parsed.DOCPARSERAPIKEY
console.log("DocParser API Key: ", docParserApiKey);
const client = new docParser.Client(docParserApiKey); // api key
const parserId = env.parsed.DOCPARSEREOBID

client.ping().then(function(){
    console.log('Connection established');
}).catch(function(err){
    console.log('Error: ', err);
});

const parsers = await client.getParsers()
    .then(function (parsers) {
        console.log("Found Parsers: ", parsers);
        return parsers;
    }).catch(function (err) {console.log(err)});


async function findParserbyId (ps, pid) {
    for(var i = 0; i < ps.length; i++) {
        if( ps[i].id === pid ) {
            console.log("Found parser: ", ps[i]);
            return ps[i];
        }
    }
}

async function getData(parser) {
    // option parameters:
    // list: "last_uploaded, uploaded_after, processed_after some date"
    // limit: number, max 10,000
    //
    const d = await client.getResultsByParser(parser.id, {format: 'object'})
    .then(function (result) {
        let data = result[0].data;
        console.log("DocParser Data: ", data)
        return data;
    })
    .catch(function (err) {
        console.log(err);
        return false;
    });
    return d;
}

const configuration = new Configuration({
    apiKey: env.parsed.OPENAIAPIKEY,
    echo: true
});

const parser = await findParserbyId(parsers, parserId);
const data = await getData(parser);
const openai = new OpenAIApi(configuration);
const prompt = "1) Parse the data into this: \n"; 
const parse = "2) Notes | Payee | Provider | Reference ID | DOS | Charges | Patient|Remark | Claim | Claim Number | Claim Date | Patient | Responsibility \n";
const questions = "3) Then summarize the information by answering the following: Who is the provider? Who is the payee? Who received the services? Who are the responsible parties? How much do each party owe?\n";
const summary = "4) Then parse the summary into: Services | Claims | Patients | Notes \n";
const instructions = data + "\n" + prompt + parse + questions + summary;
console.log(instructions);
const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: instructions,
    temperature: 0.14,
    max_tokens: 306,
    top_p: 1,
    best_of: 3,
    frequency_penalty: 0.75,
    presence_penalty: 0.31,
});
const findings = response.data;
const choices = findings.choices;
console.log(choices);
