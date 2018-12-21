const config = require('./config.json');
const TwitchBot = require('twitch-bot');
const TwitchAPI = require('twitch-api-v5');
const analyze = require('Sentimental').analyze;
const Store = require('data-store');
const moment = require('moment');

//data
const commands = new Store('commands',{ path:'data/commands.json' });
const chatters = new Store('chatters',{ path:'data/db.json' })

//arrays required for sentimental
const SentiResults = [];
const words= [];
//Bot config
const Bot = new TwitchBot({
    username: config.username,
    oauth: config.oauth,
    channels: ['#fing3rguns']
})

//set twitch api client id
TwitchAPI.clientID = config.client_id;

Bot.on('join', channel => {
    console.log(`Joined channel: ${channel}`);
    Bot.say("I'm awake! Request away.");
})

Bot.on('error', err => {
    console.log(err);
})

Bot.on('subscription ', event => {
    console.log(event);
});


Bot.on('message', chatter => {
    //on every message look for timed commands(probs should change this)....
    lookForTimedCommands(timedCallback);
    let mArray = messageToArray(chatter.message);
    
    //setup sentiment scores
    startSent(chatter.message, chatter.username);
    ss = getSentOverallScore();
    setupWords(mArray);
    wordCount = getWordCount();
    //sentiment done.
    
    if(findUser(chatter.user_id) == true ){
        updateUserWordCount(chatter.user_id,wordCount);
    }

    
    //dates for chat log...
    d = new Date()
    var options = {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    };
    const timeString = d.toLocaleString('en-US', options);
    
    //log chat so I can see it :) and viewers
    console.log('[%s] %s - %s',timeString,chatter.username,chatter.message);
    
    //checking to see if message contains command prefix
    if(mArray[0].match('!')){
        let commandFoundRes = {}
        if(checkIfCustomCommand(mArray[0],commandCallback)){
            console.log('In if statement for command');
        }
    }
    //shoutout command uses twitch search api
    if(checkIfCommand(mArray[0],'!so')){
        channel = mArray[1];
        console.log('searching kraken for %s',channel);
        TwitchAPI.search.channels({
            query:encodeURI(channel)
        },(err, res) => {
            console.log(res._total);
            let soMessage;
            let found = res._total;
            if( found === 0){
                soMessage = 'channel not found, try again LUL'  
            }
            else if(err) {
                //console.log(err);
                soMessage = 'channel not found, try again LUL'
            } 
            else {
                let sr = res.channels;   
                console.log(sr[0]);
                soMessage = 'Give '+sr[0].display_name+' a Follow and some fingerguns love, they have '+sr[0].followers+' followers! => '+sr[0].url;
            }
            Bot.say(soMessage);
        });   
    }
    //check if reg command
    if(checkIfCommand(mArray[0],'!reg')){
        result = checkIfuserExists(chatter);
        Bot.say('@'+result);
    }

    if(checkIfCommand(mArray[0],'!count')){
        result = getUserInfo(chatter.user_id);
        Bot.say('@'+chatter.username+' you currently have wrote '+result.info.msgCount+' words since '+moment(result.created).format('DD-MM-YY')+', Thank you for contributions!');
    }

    //check if sentimental command
    if(checkIfCommand(mArray[0],'!sentimental')){
        let sentMessage = '@'+chatter.username+' Currently I have processed '+ wordCount + ' words, and the sentiment is currently '+ setupSentiEmoji(ss);
        console.log(sentMessage);
        Bot.say(sentMessage);
    }

    //tiger fact command, selects a random fact from facts array
    if(checkIfCommand(mArray[0],'!tigerfact')) {

        let facts =[
            'Females give birth to litters of one to four cubs. Cubs cannot hunt until they are 18 months old and remain with their mothers for two to three years, when they disperse to find their own territory.',
            'The most immediate threat to wild tigers is poaching. Their body parts are in relentless demand for traditional medicine and are status symbols within some Asian cultures. The resources for guarding protected areas where tigers live are usually limited. Even countries that strongly enforce tiger protection laws fight a never-ending battle against poaching. In Indochina and China, poaching is so pervasive that many forests are now without tigers.',
            'People and tigers increasingly compete for space. The conflict threatens the world’s remaining wild tigers and poses a major problem for communities living in or near them. As forests shrink and prey becomes scarce, tigers are forced to hunt domestic livestock, which many local communities depend on for their livelihoods. In retaliation, tigers are killed or captured. Community dependence on forests for fuel wood, food and timber also heightens the risk of tiger attacks on people. ‘Conflict’ tigers are commonly sold on the black market. ',
            'Tigers have lost 93% of their historical range. Their habitat has been destroyed, degraded and fragmented by human activities. The clearing of forests for agriculture and timber as well as the building of roads and other development activities pose serious threats to tiger habitats. Fewer tigers can survive in small, scattered islands of habitat, which leads to a higher risk of inbreeding and makes tigers more vulnerable to poaching.',
            'Tiger stripes are like human fingerprints. No two tigers have the same pattern of stripes.',
            'The average lifespan of a wild Bengal tiger is about 15 years.',
            'For tigers, only one in ten hunts for prey are successful.',
            'Tiger cubs remain dependent on their mother for food until they’re about 18 months old.',
            '100,000 wild tigers roamed Asia a century ago, but today their numbers have fallen to around 3,200 due to poaching.',
            'Various tiger subspecies are the national animals of Bangladesh, India, North Korea, South Korea and Malaysia.',
            'A dead adult tiger male can sell for U.S. $10,000 or more on the black market.',
            'The tiger generally hunts alone, able to bring down prey such as deer and antelope.',
            'Unlike lions, tigers live solitary lives and mark their territories to keep others away.',
            'Tigers use their tails to communicate with one another.',
            'The tiger is the largest wild cat in the world. The big cat weighs up to 720 pounds (363 kilograms), stretches 6 feet (2 meters) long.'
            ];

        let randomNumber = Math.floor(Math.random()*facts.length);
        Bot.say('Rolling the dice, what fact will you get?');
        Bot.say('Executing tiger fact '+randomNumber);
        Bot.say(facts[randomNumber]);
    }

    //create command, needs a name , seconds(0 for no time) and message
    if(checkIfCommand(mArray[0],'!createCMD')){
        name = mArray[1];
        int = mArray[2];
        commandArry = [mArray[0],name,int];
        messageArray = mArray.filter( function( el ) {
            return commandArry.indexOf( el ) < 0;
        });
        finalMessage = messageArray.join(" ");
        CMDresult = CreateCommand(chatter, name, int, finalMessage);
        Bot.say(CMDresult);
    }
})

//check if message contains a command
function checkIfCommand(command,name){
    if(command === name){
        return true;
    }else{
        return false;
    }
}

//check for custom command made via createCMD
function checkIfCustomCommand(command,callback){
    lookFor = command.replace('!','');
    console.log('looking for command', lookFor);
    let check = commands.get('commands.'+lookFor);
    commandFoundRes = check;
    if(check){ 
        if (typeof callback === "function") {
            console.log('command found',commandFoundRes);
            callback(commandFoundRes);
        }
        return true;
    }else{
        console.log('command not found in command.json now checking bot commands');
        return false;
    }
}

//call back for custom command, checks to see if command has multiple messages and rolls a random number.
function commandCallback(data){
    let randomNumber = Math.floor(Math.random()*data.length);
    console.log('Bot Said -',data[randomNumber].message);
    Bot.say(data[randomNumber].message);
}

//call back for a lookForTimedCommands and multiples messages seconds * 60 and posts it.
function timedCallback(data){
    currentTime = new Date();
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            let e = data[key];
            for (let i = 0; i < e.length; i++) {
                const timeCommand = e[i];
                let commandTime = timeCommand.time;
                
                if(commandTime> 10){
                    console.log("Loaded timed commaned: %s ", JSON.stringify(timeCommand));
                    setTimeout(postTimedCommand,commandTime*60,timeCommand.message);    
                }
            }
        }
    }    
}

//function for posting a time command from timedCallback
function postTimedCommand(message){
    d = new Date()
    var options = {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    };
    const timeString = d.toLocaleString('en-US', options);
    console.log('['+timeString+'] Bot posted timed message-', message)
    Bot.say(message);
}

//convert message to Array
function messageToArray(string){
    return string.split(" ");
}

//Sentiment the message string and pushes result to sentiResults
function startSent(string,username){
    result = {
        user: username,
        senti:analyze(string)
    }
    SentiResults.push(result);
}

//returns chats sentiment score
function getSentOverallScore(){
    //console.log(SentiResults);
    overallScore = 0;
    for (let i = 0; i < SentiResults.length; i++) {
        let row = SentiResults[i].senti;
        rowScore = row.score;
        //console.log('row score,',rowScore);
        overallScore += rowScore;
    }
    return overallScore/SentiResults.length;
}

//push message words to main array
function setupWords(array){
    for (let i = 0; i < array.length; i++) {
        let word = array[i];
        words.push(word);
    }
}

// retuns word count from array
function getWordCount(){
    return words.length;
}

//convert score to a emoji
function setupSentiEmoji(score) {
	if(score <= -5){
		return "PJSalt";
	}
	if(score <= -2){
		return "SSSsss";
	}
	if(score <= 0){
		return "StinkyCheese"
	}
	if (score <= 5) {
		return "CoolCat";
	}
	else {
		return "CoolCat CorgiDerp";
	}
}

// function for creating commands (name, int, saves commands to json file returns and ID)
function CreateCommand(chatter, name, int, message){

    let canDO = checkIfMod(chatter);
    let allCommmandVars = checkAllCommandsExist(chatter,name,int,message);
    if(!canDO){
        return '@'+chatter.username +', You need Mod permissions';
    }
    else{
        if(!allCommmandVars.Exist){
            return allCommmandVars.msg;
        }
        else{
            console.log('Saving CMD');
            commandObject = {
                time: parseInt(int),
                message: message
            }
            console.log(commandObject);
            commands.union('commands.'+name,commandObject);
            console.log(commands.data);
            console.log('CMD Saved');
            return allCommmandVars.msg;
        }
    }
    
}

// function to see if chatter is a mod, broadcaster or staff
function checkIfMod(chatter){
    //console.log(chatter);
    // define mod and broadcaster badge
    let mod = chatter.mod;
    let isBroadcaster = chatter.badges.broadcaster;

    //set mod true if owner of channel
    if(isBroadcaster === 1){
        return true;
    } 
    else if(!mod){
        return false;
    }
}

//function to see if all vars exist on createCMD
function checkAllCommandsExist(chatter,name,int,message){

    isNumber = isNaN(int);
    let msg = String;
    let CommandsExist = Boolean;
    if(!name){
        CommandsExist = false;
        msg = '@'+chatter.username +', Please supply a command name....';
    }
    else if(!int){
        CommandsExist = false;
        msg = '@'+chatter.username +', Please supply a time in seconds...';
    }
    else if(isNumber){
        CommandsExist = false;
        msg = '@'+chatter.username +', Please supply a time in seconds not a string....';
    }
    else if(!message){
        CommandsExist = false;
        msg = '@'+chatter.username +', Please supply a message for the command....';
    } else{
        CommandsExist = true;
        msg = '@'+chatter.username +', Please wait setting up command...';
    }
    return {
        Exist: CommandsExist,
        msg: msg
    }
}

// function for montioring time (using date, monitor with id of command and int)
function lookForTimedCommands(callback){
    let commandFoundRes = commands.get('commands'); 
    if (typeof callback === "function") {
        callback(commandFoundRes);
    }
}


function checkIfuserExists(chatter){

    lookFor = chatter.user_id
    console.log('looking for command', lookFor);
    let check = chatters.get('chatters.'+lookFor);
    if(check){
        console.log('exists');
        result = chatter.username+" you are already registered";
    }else{
        console.log('new user, adding ', lookFor);
        result = createChatter(chatter);
    }
    return result;
}


function createChatter(chatter){

    userData = {
        username:chatter.username,
        created:new Date(),
        updated:new Date(),
        info:{
            points:0,   
            bonus:0,
            msgCount:0,
        },
    }

    chatters.union('chatters.'+chatter.user_id,userData);
    return chatter.username+' you were sucessfully registered';
}

function updateUserWordCount(id,count){
    user = 'chatters.'+id;
    current = chatters.get(user);

    currentInfo = current;

    updatedInfo = {
        username:currentInfo.username,
        created:currentInfo.created,
        updated:new Date(),
        info:{
            points:0,   
            bonus:0,
            msgCount:currentInfo.info.msgCount+count,
        },
    }
    
    chatters.set(user,updatedInfo);
    // chatters.set(user, current+count);
}

function findUser(chatterID){
    lookFor = chatterID
    console.log('looking for command', lookFor);
    let check = chatters.get('chatters.'+lookFor);
    if(check){
        return true
    }else{
        return false
    }
}

function getUserInfo(id){
    user = 'chatters.'+id;
    current = chatters.get(user);

    return current;
}