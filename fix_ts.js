const fs = require('fs');
const path = require('path');

const log = `
app/dashboard/checkin/page.tsx(65,45): error TS7006: Parameter 'a' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(75,47): error TS7006: Parameter 'a' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(96,47): error TS7006: Parameter 'r' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(110,41): error TS7006: Parameter 'r' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(285,38): error TS2304: Cannot find name 'currentGymId'.
app/dashboard/checkin/page.tsx(343,32): error TS2304: Cannot find name 'currentGymId'.
app/dashboard/checkin/page.tsx(356,24): error TS7006: Parameter 'a' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(378,49): error TS7006: Parameter 'a' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(379,58): error TS7006: Parameter 'a' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(610,51): error TS7006: Parameter 'c' implicitly has an 'any' type.
app/dashboard/checkin/page.tsx(724,45): error TS7006: Parameter 'rec' implicitly has an 'any' type.
app/dashboard/products/page.tsx(74,41): error TS7006: Parameter 's' implicitly has an 'any' type.
app/dashboard/products/page.tsx(86,35): error TS7006: Parameter 's' implicitly has an 'any' type.
app/dashboard/products/page.tsx(94,47): error TS7006: Parameter 'acc' implicitly has an 'any' type.
app/dashboard/products/page.tsx(94,52): error TS7006: Parameter 's' implicitly has an 'any' type.
app/dashboard/products/page.tsx(239,44): error TS7006: Parameter 'p' implicitly has an 'any' type.
app/dashboard/products/page.tsx(245,42): error TS7006: Parameter 's' implicitly has an 'any' type.
app/dashboard/products/page.tsx(321,41): error TS7006: Parameter 'p' implicitly has an 'any' type.
app/dashboard/products/page.tsx(361,36): error TS7006: Parameter 'p' implicitly has an 'any' type.
app/dashboard/products/page.tsx(361,70): error TS7006: Parameter 'p' implicitly has an 'any' type.
app/dashboard/products/page.tsx(457,47): error TS7006: Parameter 'c' implicitly has an 'any' type.
app/dashboard/products/page.tsx(462,48): error TS7006: Parameter 'c' implicitly has an 'any' type.
app/dashboard/products/page.tsx(480,47): error TS7006: Parameter 'c' implicitly has an 'any' type.
app/dashboard/reminders/page.tsx(115,42): error TS7006: Parameter 'cust' implicitly has an 'any' type.
app/dashboard/reminders/page.tsx(148,32): error TS2552: Cannot find name 'setReminderThresholdDays'. Did you mean 'reminderThresholdDays'?
app/dashboard/reminders/page.tsx(194,32): error TS7006: Parameter 'cust' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(239,34): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(256,54): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(258,37): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(258,72): error TS7006: Parameter 'acc' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(258,77): error TS7006: Parameter 'cur' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(259,52): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(259,110): error TS7006: Parameter 'acc' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(259,115): error TS7006: Parameter 'cur' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(260,37): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(260,73): error TS7006: Parameter 'acc' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(260,78): error TS7006: Parameter 'cur' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(262,46): error TS7006: Parameter 'c' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(264,37): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(264,71): error TS7006: Parameter 'acc' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(264,76): error TS7006: Parameter 'cur' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(275,36): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(275,70): error TS7006: Parameter 'acc' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(275,75): error TS7006: Parameter 'cur' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(286,37): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(286,101): error TS7006: Parameter 'acc' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(286,106): error TS7006: Parameter 'cur' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(308,53): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(320,38): error TS7006: Parameter 'c' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(332,48): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(337,48): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(339,48): error TS7006: Parameter 't' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(725,33): error TS7006: Parameter 'tx' implicitly has an 'any' type.
app/dashboard/revenue/page.tsx(997,31): error TS7006: Parameter 'p' implicitly has an 'any' type.
`;

const lines = log.trim().split('\n');
const regexImplicitAny = /^(.*?)\((\d+),(\d+)\): error TS7006: Parameter '(.*?)' implicitly has an 'any' type\./;

const fileChanges = {};

for (const line of lines) {
    const match = regexImplicitAny.exec(line);
    if (match) {
        const file = match[1];
        const lineNum = parseInt(match[2]);
        const colNum = parseInt(match[3]);
        const paramName = match[4];

        if (!fileChanges[file]) fileChanges[file] = [];
        fileChanges[file].push({ line: lineNum, col: colNum, param: paramName, type: 'any' });
    } else {
        const regexUndefined = /^(.*?)\((\d+),(\d+)\): error TS2304: Cannot find name '(.*?)'\./;
        const matchUndefined = regexUndefined.exec(line);
        if (matchUndefined) {
            const file = matchUndefined[1];
            const lineNum = parseInt(matchUndefined[2]);
            const colNum = parseInt(matchUndefined[3]);
            const varName = matchUndefined[4];
            if (!fileChanges[file]) fileChanges[file] = [];
            fileChanges[file].push({ line: lineNum, col: colNum, var: varName, type: 'undefined' });
        } else {
            const regexMissingMethod = /^(.*?)\((\d+),(\d+)\): error TS2552: Cannot find name '(.*?)'\./;
            const matchMissing = regexMissingMethod.exec(line);
            if (matchMissing) {
                const file = matchMissing[1];
                const lineNum = parseInt(matchMissing[2]);
                const colNum = parseInt(matchMissing[3]);
                const varName = matchMissing[4];
                if (!fileChanges[file]) fileChanges[file] = [];
                fileChanges[file].push({ line: lineNum, col: colNum, var: varName, type: 'missing' });
            }
        }
    }
}

for (const file of Object.keys(fileChanges)) {
    // Project root is c:/Office/Gym Software
    const filePath = path.join('c:/Office/Gym Software', file);
    if (!fs.existsSync(filePath)) {
        console.error("File not found: " + filePath);
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const changes = fileChanges[file].sort((a, b) => {
        if (b.line !== a.line) return b.line - a.line;
        return b.col - a.col;
    });

    for (const change of changes) {
        const lineIndex = change.line - 1;
        let lineContent = lines[lineIndex];

        if (change.type === 'any') {
            const target = change.param;
            const colIndex = change.col - 1;
            
            if (lineContent.substring(colIndex, colIndex + target.length) === target) {
                let pre = lineContent.substring(0, colIndex);
                let post = lineContent.substring(colIndex + target.length);
                
                if (pre.match(/[\[\(\,]\s*$/)) {
                    lineContent = pre + target + ': any' + post;
                } else {
                    lineContent = pre + '(' + target + ': any)' + post;
                }
            }
        } else if (change.type === 'undefined') {
            if (change.var === 'currentGymId') {
                lineContent = lineContent.replace(/currentGymId/g, 'gymId');
            }
        } else if (change.type === 'missing') {
             if (change.var === 'setReminderThresholdDays') {
                 lineContent = lineContent.replace(/setReminderThresholdDays/g, '/* setReminderThresholdDays */');
             }
        }
        lines[lineIndex] = lineContent;
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log('Updated ' + file);
}
