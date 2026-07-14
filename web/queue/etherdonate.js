var chainId = 0;
var token = 0;
var currentToken = null;
var eurovalue = 3.0; // default donation amount
var cgPrices = null;
var ethProvider = null; // the EIP-1193 provider currently in use
const ethProviders = new Map(); // uuid -> {info, provider}, from EIP-6963 announcements
var discoveryFinalized = false; // true once we've decided which provider(s) to offer

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
            {
                token: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
                symbol: "USDC",
                cgid: "usd",
                decimals: 6,
            },
            {
                token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
                symbol: "USDT",
                cgid: "usd",
                decimals: 6,
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
        const accounts = await ethProvider.request({
            method: 'eth_requestAccounts',
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
            result = await ethProvider.request({method: "eth_sendTransaction", params: [
                { from: from,
                  chainId: ethNetworks[chainId].chainId,
                  to: token,
                  data: data,
                  value: "0x" } ]});
        } else {
            const hexValue = "0x" + parsedValue.toString(16);
            result = await ethProvider.request({
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
        await ethProvider.request({
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
    const chid = await ethProvider.request({
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
    xhr.open("GET", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum%2Cusd&vs_currencies=eur");
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

// EIP-6963 (https://eips.ethereum.org/EIPS/eip-6963): wallets announce themselves
// via an event instead of fighting over `window.ethereum`. Just listening for
// the announcement is passive -- it never talks to a wallet and never causes
// a popup. We only ever call .request() on a provider the user has actually
// chosen (implicitly, when there is only one; explicitly, via the wallet
// dropdown, when there are several).
function handleAnnounceProvider(event) {
    const { info, provider } = event.detail;
    if (ethProviders.has(info.uuid)) {
        return;
    }
    ethProviders.set(info.uuid, { info, provider });
    // If we already finalized a choice (or already showed the dropdown),
    // fold late announcements in without re-deciding for the user.
    if (!ethProvider && discoveryFinalized) {
        chooseDiscoveredProvider();
    }
}

// Called once discovery has had time to settle (all wallets that were going
// to answer the initial "eip6963:requestProvider" broadcast synchronously
// have done so), and again for any wallet that announces itself late.
function chooseDiscoveredProvider() {
    discoveryFinalized = true;
    if (ethProviders.size === 1) {
        const { info, provider } = ethProviders.values().next().value;
        useProvider(provider, info.name);
    } else if (ethProviders.size > 1) {
        showWalletChoice();
    } else if (typeof window.ethereum !== 'undefined') {
        // No EIP-6963 announcements at all: fall back to the legacy global
        // for wallets that don't support EIP-6963 yet.
        const legacyName = window.ethereum.isBraveWallet ? "Brave" : window.ethereum.isFrame ? "Frame" : window.ethereum.isMetaMask ? "MetaMask" : "your Browser Wallet";
        useProvider(window.ethereum, legacyName);
    }
}

function showWalletChoice() {
    const selectobj = document.getElementById("ethwallet");
    while (selectobj.firstChild) {
        selectobj.removeChild(selectobj.firstChild);
    }
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.text = "Choose a wallet";
    placeholder.selected = true;
    selectobj.add(placeholder);
    ethProviders.forEach(({ info }) => {
        const optobj = document.createElement("option");
        optobj.value = info.uuid;
        optobj.text = info.name;
        selectobj.add(optobj);
    });
    selectobj.onchange = (event) => {
        const chosen = ethProviders.get(event.currentTarget.value);
        if (chosen) {
            useProvider(chosen.provider, chosen.info.name);
        }
    };
    // #ethwalletchoice lives inside #ethdonate, so the outer container has to
    // be shown too, even though we haven't picked (and won't touch) a
    // provider yet.
    document.getElementById("ethdonate").style.display = "inline-block";
    document.getElementById("ethwalletchoice").style.display = "inline-block";
}

function useProvider(provider, name) {
    ethProvider = provider;
    document.getElementById("ethapp").innerText = name;
    document.getElementById("ethdonate").style.display = "inline-block";
    checkChainId();

    ethProvider.on("chainChanged", updateChain);
    document.getElementById("ethsendbutton").onclick = sendTransaction;
    document.getElementById("ethamount").onchange = updateAmount;
    document.getElementById("ethtoken").onchange = updateToken;
    document.getElementById("ethnetwork").onchange = updateNetwork;
    getCoinGeckoPrices();
}

function ethInit() {
    window.addEventListener("eip6963:announceProvider", handleAnnounceProvider);
    // Asks any already-listening wallet to (re-)announce itself. This is a
    // plain DOM event, not a provider RPC call, so it cannot trigger a wallet
    // popup by itself.
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Give injected wallets a moment to answer -- multiple wallets can all
    // respond to the broadcast above, so we wait for the full batch before
    // deciding whether to auto-select or ask the user, rather than jumping on
    // the first announcement to arrive.
    setTimeout(chooseDiscoveredProvider, 200);
}

