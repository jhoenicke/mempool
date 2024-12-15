var chainId = 0;
var token = 0;
var currentToken = null;
var eurovalue = 3.0; // default donation amount
var cgPrices = null;

const ethNetworks = {
    1: {
        chainId: "0x1",
        chainName: "Ethereum Mainnet",
        tokens: [
            {
                token: 0,
                symbol: "ETH",
                cgid: "ethereum",
                decimals: 18
            },
            {
                token: "0x6b175474e89094c44da98b954eedeac495271d0f",
                symbol: "DAI",
                cgid: "usd",
                decimals: 18,
            },
            {
                token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                symbol: "USDC",
                cgid: "usd",
                decimals: 6,
            },
            {
                token: "0xdac17f958d2ee523a2206206994597c13d831ec7",
                symbol: "USDT",
                cgid: "usd",
                decimals: 6,
            },
        ],
        blockExplorerUrls: ["https://etherscan.io/"]
    },
    42161: {
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        tokens: [
            {
                token: 0,
                symbol: "ETH",
                cgid: "ethereum",
                decimals: 18
            },
            {
                token: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
                symbol: "DAI",
                cgid: "usd",
                decimals: 18,
            },
            {
                token: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
                symbol: "USDC",
                cgid: "usd",
                decimals: 6,
            },
            {
                token: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
                symbol: "USDT",
                cgid: "usd",
                decimals: 6,
            },
        ],
        blockExplorerUrls: ["https://explorer.arbitrum.io/"]
    },
    8453: {
        chainId: "0x2105",
        rpcUrls: ["https://mainnet.base.org/"],
        chainName: "Base",
        tokens: [
            {
                token: 0,
                symbol: "ETH",
                cgid: "ethereum",
                decimals: 18
            },
            {
                token: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
                symbol: "USDT",
                cgid: "usd",
                decimals: 6,
            },
            {
                token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                symbol: "USDC",
                cgid: "usd",
                decimals: 6,
            },
            {
                token: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
                symbol: "DAI",
                cgid: "usd",
                decimals: 18,
            },
        ],
        blockExplorerUrls: ["https://basescan.org/"]
    },
    10: {
        chainId: "0xa",
        chainName: "Optimism",
        tokens: [
            {
                token: 0,
                symbol: "ETH",
                cgid: "ethereum",
                decimals: 18
            },
            {
                token: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
                symbol: "DAI",
                cgid: "usd",
                decimals: 18,
            },
            {
                token: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
                symbol: "USDC",
                cgid: "usd",
                decimals: 6,
            },
            {
                token: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
                symbol: "USDT",
                cgid: "usd",
                decimals: 6,
            },
        ],
        blockExplorerUrls: ["https://optimistic.etherscan.io/"]
    },
    100: {
        chainId: "0x64",
        chainName: "Gnosis",
        tokens: [
            {
                token: 0,
                symbol: "xDAI",
                cgid: "usd",
                decimals: 18
            },
            {
                token: "0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1",
                symbol: "WETH",
                cgid: "ethereum",
                decimals: 18
            },
        ],
        blockExplorerUrls: ["https://blockscout.com/poa/xdai/"]
    },
    137: {
        chainId: "0x89",
        rpcUrls: ["https://rpc-mainnet.matic.network/"],
        chainName: "Polygon Mainnet",
        tokens: [
            {
                token: 0,
                symbol: "MATIC",
                cgid: "matic-network",
                decimals: 18
            },
            {
                token: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
                symbol: "WETH",
                cgid: "ethereum",
                decimals: 18
            },
            {
                token: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
                symbol: "DAI",
                cgid: "usd",
                decimals: 18,
            },
        ],
        blockExplorerUrls: ["https://polygonscan.com/"]
    },
};


function ethReportError(msg) {
    const msgobj = document.getElementById("ethmessage");
    msgobj.style.color = "#800000";
    msgobj.innerText = msg;
}
function ethReportResultHtml(msg) {
    const msgobj = document.getElementById("ethmessage");
    msgobj.style.color = "#000000";
    msgobj.innerHTML = msg;
}
async function sendTransaction() {
    ethReportResultHtml("");
    var amountraw = document.getElementById("ethamount").value;
    const decimals = currentToken.decimals;
    const dotPos = amountraw.indexOf(".");
    const floor = (dotPos < 0 ? amountraw : amountraw.substring(0, dotPos));
    const frac = (dotPos < 0 ? "" : amountraw.substring(dotPos + 1)) +
          "000000000000000000000000000000000000";
    const parsedValue = BigInt(floor) * (10n ** BigInt(decimals))
        + BigInt(frac.substring(0,decimals));
    try {
        const accounts = await window.ethereum.request({
            method: 'eth_accounts',
            params: [],
        });
        if (accounts.length === 0) {
            ethReportError('Please connect your account');
            return;
        }
        const from = accounts[0];
        var result;
        if (token != 0) {
            var data = "0000000000000000000000000000000000000000000000000000000000000000"
                + parsedValue.toString(16);
            data = data.substring(data.length - 64);
            // transfer + recipient + value;
            data = "0xa9059cbb" +
                "000000000000000000000000c6f9a38c4b0269deef360aed2852b7d22b6297d9" +
                data;
            result = await window.ethereum.request({method: "eth_sendTransaction", params: [
                { from: from,
                  chainId: ethNetworks[chainId].chainId,
                  to: token,
                  data: data,
                  value: "0x" } ]});
        } else {
            const hexValue = "0x" + parsedValue.toString(16);
            result = await window.ethereum.request({
                method: "eth_sendTransaction",
                params: [
                    { from: from,
                      chainId: ethNetworks[chainId].chainId,
                      to: "0xC6F9a38C4B0269Deef360aeD2852b7D22b6297d9",
                      gas: "0x5208",
                      value: hexValue } ]});
        }
        ethReportResultHtml("Thank you, <a href='"+ethNetworks[chainId].blockExplorerUrls[0]+"tx/"+result+"'>transaction</a> sent!");
    } catch (error) {
        console.log(error);
        ethReportError(error.message);
    }
}

function updateTokenList(tokens) {
    const selectobj = document.getElementById("ethtoken");
    while (selectobj.firstChild) {
        selectobj.removeChild(selectobj.firstChild);
    }
    tokens.forEach(tok => {
        const optobj = document.createElement("option");
        optobj.value = tok.token;
        optobj.text = tok.symbol;
        selectobj.add(optobj);
    });
    currentToken = tokens[0];
    selectobj.value = tokens[0].token;
    token = tokens[0].token;
    setAmount();
}

function setChainId(id) {
    if (!ethNetworks[id]) {
        id = 0;
    }
    chainId = id;
    document.getElementById("ethnetwork").value = id;
    if (id != 0) {
        updateTokenList(ethNetworks[id].tokens);
    }
}

async function switchChainId(id) {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [ { chainId: ethNetworks[id].chainId } ]
        });
        checkChainId();
    } catch (error) {
        ethReportError(error.message);
        checkChainId();
    }
}

function updateNetwork(event) {
    ethReportResultHtml("");
    const id = event.currentTarget.value;
    if (id != 0) {
        switchChainId(id);
    }
}

function updateToken(event) {
    token = event.currentTarget.value;
    ethNetworks[chainId].tokens.forEach((tk) => {
        if (tk.token == token) {
            currentToken = tk;
        }
    });
    setAmount();
}

function updateChain(chid) {
    setChainId(parseInt(chid));
}

async function checkChainId() {
    const chid = await window.ethereum.request({
        method: "eth_chainId",
        params: []
    });
    updateChain(chid);
}

function roundOff(value) {
    var divider = 1;
    while (value < 100) {
        divider *= 10;
        value *= 10;
    }
    value = Math.floor(value + 0.5) / divider;
    return value;
}

function setAmount() {
    if (cgPrices == null || currentToken == null || eurovalue == 0) {
        return;
    } else {
        const newAmount = roundOff(eurovalue / cgPrices[currentToken.cgid].eur);
        document.getElementById("ethamount").value = newAmount;
    }
}

function updateAmount(event) {
    if (cgPrices == null || currentToken == null) {
        eurovalue =  0;
    } else {
        eurovalue = event.currentTarget.value * cgPrices[currentToken.cgid].eur;
    }
}

function getCoinGeckoPrices() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum%2Cusd%2Cmatic-network&vs_currencies=eur");
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            cgPrices = JSON.parse(xhr.response);
            setAmount();
        } else {
            ethReportError(xhr.statusText);
        }
    };
    xhr.onerror = function () {
        ethReportError(xhr.statusText);
    };
    xhr.send();
}

function ethInit() {
    if (typeof window.ethereum !== 'undefined') {
        document.getElementById("ethapp").innerText = window.ethereum.isBraveWallet ? "Brave" : window.ethereum.isFrame ? "Frame" : window.ethereum.isMetaMask ? "MetaMask" : "your Browser Wallet";
        document.getElementById("ethdonate").style.display = "inline-block";
        checkChainId();

        window.ethereum.on("chainChanged", updateChain);
        document.getElementById("ethsendbutton").onclick = sendTransaction;
        document.getElementById("ethamount").onchange = updateAmount;
        document.getElementById("ethtoken").onchange = updateToken;
        document.getElementById("ethnetwork").onchange = updateNetwork;
        getCoinGeckoPrices();
    }
}

