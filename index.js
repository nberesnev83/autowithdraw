require('./dotenv/main').config({ path: '/opt/btfs/btfs.conf' });
const password = process.env.WALLET_PASSWORD;
const url = process.env.AUTOWITHDRAW_APIURL;
const amountLimit = process.env.AUTOWITHDRAW_LIMIT;
const logBalance = process.env.AUTOWITHDRAW_LOGGING;
const minAmount = process.env.AUTOWITHDRAW_MINIMUM;
const interval = process.env.AUTOWITHDRAW_INTERVAL * 1000;

const fetch = require('node-fetch');
const log = require('./middleware/log');

const lastData = {
    amount: 0,
    balance: 0,
}

const scan = async () => {
    const balance_tmp = await execShellCommand("/opt/btfs/bin/btfs wallet balance");
    const balance = Math.floor(balance_tmp.BtfsWalletBalance / 1000000);

    if (logBalance && lastData.balance !== balance) {
        lastData.balance = balance;
        log.info(`${new Date().toLocaleString()}:\tBTT:`, balance);
    }

    if (balance < 1001) return;

    const {tokenBalances} = await fetch(url || 'https://apiasia.tronscan.io:5566/api/account?address=TA1EHWb1PymZ1qpBNfNj9uTaxd18ubrC7a').then(text => text.json());
    let {balance: amount} = tokenBalances.find(token => token.tokenId === '1002000');
    amount = Math.floor(amount / 1000000)

    if (logBalance && lastData.amount !== amount) {
        lastData.amount = amount;
        log.info(`${new Date().toLocaleString()}:\tAmount:`, amount);
    }

    if (amount < minAmount || amount < 1001) return;

    let withdrawSum = Math.min(amountLimit, balance, amount);
    withdrawSum = (Math.floor(withdrawSum) - 1) * 1000000;
    withdrawSum += 101;

    log.info(`WITHDRAW: ${withdrawSum}, BTT: ${Math.floor(withdrawSum / 1000000)}`)
    const result = await execShellCommand(`/opt/btfs/bin/btfs wallet withdraw --password=${password} ${withdrawSum}`);
    log.info('RESULT:', result);
};

const scanning = async () => {
    try {
        await scan();
    } catch (error) {
        log.info(error);
    } finally {
        setTimeout(scanning, interval);
    }
};

const run = async () => {
    log.info(`AUTO WITHDRAW: ON\nSCAN INTERVAL: ${interval} ms\n`);
    scanning();
};

function execShellCommand(cmd) {
    const exec = require("child_process").exec;
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
            try {
                const res = JSON.parse(stdout);
                resolve(res);
            } catch (e) {}
            resolve(`Error: JSON not find!\nResult: ${stderr}`);
        });
    });
}

run();
