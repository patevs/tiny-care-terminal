#!/usr/bin/env node

/**
 *  tct
 *  index.js
 */

// IMPORTS

var config = require(__dirname + '/config.js');
var gitbot = require(__dirname + '/gitbot.js');
var pomodoro = require(__dirname + '/pomodoro.js');

var ansiArt = require('ansi-art').default;

var path = require('path');
var notifier = require('node-notifier');
//var spawn = require('child_process').spawn;
//var shellescape = require('shell-escape');
var blessed = require('blessed');
var contrib = require('blessed-contrib');
var chalk = require('chalk');
var bunnySay = require('sign-bunny');
var yosay = require('yosay');
var weather = require('weather-js');

var forismatic = require('forismatic-node')();

var emoji = require('node-emoji');

var inPomodoroMode = false;

/*
forismatic.getQuote(function (error, quote) {
    if (!error) {
        console.log(quote);
    } else {
        console.error(error);
    }
});
*/

var screen = blessed.screen(
    {
        fullUnicode: true, // emoji or bust
        smartCSR: true,
        autoPadding: true,
        title: config.terminal_title
    });

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

// Refresh on r, or Control-R.
screen.key(['r', 'C-r'], function(ch, key) {
    tick();
});

screen.key(['s', 'C-s'], function(ch, key) {
    if (!inPomodoroMode) {
        return;
    } else if (pomodoroObject.isStopped()) {
        pomodoroObject.start();
    } else if (pomodoroObject.isPaused()) {
        pomodoroObject.resume();
    } else {
        pomodoroObject.pause();
        pomodoroHandlers.onTick();
    }
});

screen.key(['e', 'C-e'], function(ch, key) {
    if (inPomodoroMode) {
        pomodoroObject.stop();
        pomodoroHandlers.onTick();
    }
});

screen.key(['u', 'C-u'], function(ch, key) {
    if (inPomodoroMode) {
        pomodoroObject.updateRunningDuration();
        pomodoroHandlers.onTick();
    }
});

screen.key(['b', 'C-b'], function(ch, key) {
    if (inPomodoroMode) {
        pomodoroObject.updateBreakDuration();
        pomodoroHandlers.onTick();
    }
});

screen.key(['p', 'C-p'], function(ch, key) {
    if (inPomodoroMode) {
        pomodoroObject.stop();
        inPomodoroMode = false;
        doTheRQM();
        parrotBox.removeLabel('');
    } else {
        // ! emoji not supported on windows
        //parrotBox.setLabel(' 🍅 ');
        parrotBox.setLabel(' Pomodoro ');
        inPomodoroMode = true;
        pomodoroHandlers.onTick();
    }
});

var grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

// grid.set(row, col, rowSpan, colSpan, obj, opts)
var weatherBox = grid.set(0, 8, 2, 4, blessed.box, makeScrollBox(' Weather ' + emoji.get('cloud') + ' '));
var todayBox = grid.set(0, 0, 6, 6, blessed.box, makeScrollBox(' ' + emoji.get('star') + ' Last 24 hours ' + emoji.get('star') + ' '));
var weekBox = grid.set(6, 0, 6, 7, blessed.box, makeScrollBox(' ' + emoji.get('star') + ' This Week ' + emoji.get('star') + ' '));
// ! emoji not supported on windows
//var weatherBox = grid.set(0, 8, 2, 4, blessed.box, makeScrollBox(' 🌤 '));
//var todayBox = grid.set(0, 0, 6, 6, blessed.box, makeScrollBox(' 📝  Last 24 hours '));
//var weekBox = grid.set(6, 0, 6, 6, blessed.box, makeScrollBox(' 📝  Week '));
var commits = grid.set(0, 6, 6, 2, contrib.bar, makeGraphBox(' Commits ' + emoji.get('coffee') + ' '));
var parrotBox = grid.set(6, 7, 6, 5, blessed.box, makeScrollBox(''));


tick();
setInterval(tick, 1000 * 60 * config.updateInterval);

function tick() {
    doTheWeather();
    doTheRQM();
    doTheCodes();
}

function doTheWeather() {
    weather.find({search: config.weather, degreeType: config.celsius ? 'C' : 'F'}, function(err, result) {
        if (result && result[0] && result[0].current) {
            var json = result[0];
            // TODO: add emoji for this thing.
            var skytext = json.current.skytext.toLowerCase();
            var currentDay = json.current.day;
            var degreetype = json.location.degreetype;
            var forecastString = '';
            for (var i = 0; i < json.forecast.length; i++) {
                var forecast = json.forecast[i];
                if (forecast.day === currentDay) {
                    var skytextforecast = forecast.skytextday.toLowerCase();
                    forecastString = `Today, it will be ${skytextforecast} with a forecast high of ${forecast.high}°${degreetype} and a low of ${forecast.low}°${degreetype}.`;
                }
            }
            weatherBox.content = `In ${json.location.name} it's ${json.current.temperature}°${degreetype} and ${skytext} right now. ${forecastString}`;
        } else {
            weatherBox.content = 'Having trouble fetching the weather for you :(';
        }
        screen.render();
    });
}

function doTheRQM(){
    forismatic.getQuote(function (error, quote) {
        if (!error) {
            //console.log(quote);
            if(quote.quoteAuthor.length > 0){
                parrotBox.content = getAnsiArt(quote.quoteText + "\n - " + quote.quoteAuthor);
            } else {
                parrotBox.content = getAnsiArt(quote.quoteText + "\n - Unknown");
            }
            screen.render();
        } else {
            //console.error(error);
            //parrotBox.content = getAnsiArt('Hi! You\'re doing great!!!');
            parrotBox.content = error;
            screen.render();
        }
    });
}

// credit: https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors/13532993#13532993
/*
function shadeColor(color, percent) {
    var R = parseInt(color.substring(1,3),16);
    var G = parseInt(color.substring(3,5),16);
    var B = parseInt(color.substring(5,7),16);
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);
    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  
    var RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
    var GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
    var BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));
    return "#"+RR+GG+BB;
}
*/

function doTheCodes() {
    var todayCommits = 0;
    var weekCommits = 0;

    // show loading message while loading commits.
    // Turns out blessed doesn't love it if there's emoji in this or if
    // the line is super long.
    todayBox.content = weekBox.content = 'tiny commit bot is looking for tiny commits! ';
    screen.render();

    function getCommits(data, box) {
        var content = colorizeLog(data || '');
        box.content += content;
        var commitRegex = /(.......) (- .*)/g;
        return (box && box.content) ? (box.content.match(commitRegex) || []).length : '0';
    }

    gitbot.findGitRepos(config.repos, config.depth-1, (err, allRepos) => {
        if (err) {
            return todayBox.content = err;
            screen.render();
        }
        gitbot.getCommitsFromRepos(allRepos, 1, (err, data) => {
            if (err) {
                return todayBox.content = err;
                screen.render();
            }
            todayBox.content = '';
            todayCommits = getCommits(`${data}`, todayBox);
            updateCommitsGraph(todayCommits, weekCommits);
            screen.render();
        });
        gitbot.getCommitsFromRepos(allRepos, 7, (err, data) => {
            if (err) {
                return weekBox.content = err;
                screen.render();
            }
            weekBox.content = '';
            weekCommits = getCommits(`${data}`, weekBox);
            updateCommitsGraph(todayCommits, weekCommits);
            screen.render();
        });
    });

}

function makeBox(label) {
    return {
        label: label,
        tags: true,
        // draggable: true,
        border: {
            type: 'line'  // or bg
        },
        style: {
            border: { fg: 'cyan' },
            hover: { border: { fg: 'green' }, }
        }
    };
}

function makeScrollBox(label) {
    var options = makeBox(label);
    options.scrollable = true;
    options.scrollbar = { ch:' ' };
    options.style.scrollbar = { bg: 'green', fg: 'white' };
    options.keys = true;
    options.vi = true;
    options.alwaysScroll = true;
    options.mouse = true;
    return options;
}

function makeGraphBox(label) {
    var options = makeBox(label);
    options.barWidth= 5;
    options.xOffset= 4;
    options.maxHeight= 10;
    options.labelColor = 'normal';
    return options;
}

function updateCommitsGraph(today, week) {
    commits.setData({titles: ['24h', 'week'], data: [today, week]});
}

function colorizeLog(text) {
    var lines = text.split('\n');
    var regex = /(.......) (- .*) (\(.*\)) (<.*>)/i;
    var nothingRegex = /Seems like .* did nothing/i;
    for (var i = 0; i < lines.length; i++) {
        // If it's a path
        if (lines[i][0] === '/') {
            lines[i] = formatRepoName(lines[i], '/');
        } else if(lines[i][0] === '\\') {
            lines[i] = formatRepoName(lines[i], '\\');
        } else {
            // It may be a mean "seems like .. did nothing!" message. Skip it
            var nothing = lines[i].match(nothingRegex);
            if (nothing) {
                lines[i] = '';
                continue;
            }

            // It's a commit.
            var matches = lines[i].match(regex);
            if (matches) {
                lines[i] = chalk.red(matches[1]) + ' ' + matches[2] + ' ' +
                    chalk.green(matches[3]);
            }
        }
    }
    return lines.join('\n');
}

function formatRepoName(line, divider) {
    var repoPath = config.repos
        .sort((a, b) => a.length < b.length) // Longest repo repoPath first
        .find(repo => line.startsWith(repo));
    var repoRootPath = chalk.yellow(path.basename(repoPath) + divider);
    var repoChildPath = chalk.yellow.bold(
        line.replace(repoPath, '').replace(new RegExp(`^${divider}`), '')
    );
    return `\n${repoRootPath}${repoChildPath}`;
}

function llamaSay(text) {
    return `
        ${text}
        ∩∩
    　（･ω･）
    　　│ │
    　　│ └─┐○
    　  ヽ　　　丿
    　　 　∥￣∥`;
}

function catSay(text) {
    return `
        ${text}

        ♪ ガンバレ! ♪
    ミ ゛ミ ∧＿∧ ミ゛ミ
    ミ ミ ( ・∀・ )ミ゛ミ
    ゛゛ ＼　　　／゛゛
    　　 　i⌒ヽ ｜
    　　 　 (＿) ノ
    　　　　　 ∪`
        ;
}

function getAnsiArt(textToSay) {
    var artFileRegex = /.ansi$/;

    // If config.say is custom art file path, then return custom art
    if (artFileRegex.test(config.say)) {
        return ansiArt.get({ filePath: config.say, speechText: textToSay });
    }

    var ansiOptions = {
        artName: config.say,
        speechText: textToSay,
        speechBubbleOptions: {
            boxWidth: parrotBox.width < 70 ? parrotBox.width - 4 : parrotBox.width * 0.7,
            boxType: 'classic'
        }
    };

    switch (config.say) {
        case 'bunny' : return bunnySay(textToSay);
        case 'llama' : return llamaSay(textToSay);
        case 'cat'   : return catSay(textToSay);
        case 'yeoman': return yosay(textToSay);
        default : return ansiArt.get(ansiOptions);
    }
}

var pomodoroHandlers = {
    onTick: function() {
        if (!inPomodoroMode) return;
        var remainingTime = pomodoroObject.getRemainingTime();

        var statusText = '';
        if (pomodoroObject.isInBreak()) {
            statusText = ' (Break Started) ';
        } else if (pomodoroObject.isStopped()) {
            statusText = ' (Press "s" to start) ';
        } else if (pomodoroObject.isPaused()) {
            statusText = ' (Press "s" to resume) ';
        }

        var content = `In Pomodoro Mode: ${remainingTime} ${statusText}`;
        var metaData = `Duration: ${pomodoroObject.getRunningDuration()} Minutes,  Break Time: ${pomodoroObject.getBreakDuration()} Minutes\n`;
        metaData += 'commands: \n s - start/pause/resume \n e - stop \n u - update duration \n b - update break time';
        parrotBox.content = getAnsiArt(content) + metaData;
        screen.render();
    },

    onBreakStarts: function() {
        if (inPomodoroMode) {
            notifier.notify({
                title: 'Pomodoro Alert',
                message: 'Break Time!',
                sound: true,
                timeout: 30,
            });
        }
    },

    onBreakEnds: function() {
        if (inPomodoroMode) {
            notifier.notify({
                title: 'Pomodoro Alert',
                message: 'Break Time Ends!',
                sound: true,
                timeout: 30,
            });
        }
    },

    runningDuration: parseInt(config.runningDuration, 10),

    breakDuration: parseInt(config.breakDuration, 10),
};

var pomodoroObject = pomodoro(pomodoroHandlers);


// EOF

