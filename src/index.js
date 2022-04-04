const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = require('../configs/telegramToken');
const {binanceListingNewsURL, coinMarketCapURL} = require('../configs/URLS');
const {
    BinanceNewsListingSelector,
    MEXCTickerSelector,
    GateIoSelector,
    KuCoinSelector
} = require('../configs/selectors');
const listingOn = require('./listingKeywords');
const {
    MEXC,
    GateIo,
    KuCoin
} = require('../configs/cryptoCurrencyName');
const {telegramID} = require('../configs/telegramIDS')

const bot = new TelegramBot(TOKEN, {polling: true});

let lastListingNews = '';
let cryptoListingName = '';

async function parse(parseURL, selector) {

    try {

        const browser = await puppeteer.launch(); //Загрузка браузера
        const page = await browser.newPage(); //Открытие новой вкладки
        await page.goto(parseURL); //Переход на страницу которую хотим спарсить

        //Ждем когда загрузится селектор и вытягиваем из него текст
        await page.waitForSelector(selector);
        const listingText = await page.$eval(selector, (element) => element['innerText']);
        const listingURL = await page.$eval(selector, (element) => `https://www.binance.com/${element.getAttribute('href')}`);
        // console.log(listingText)
        // const listingText = 'Binance Will List ApeCoin (SDASDSADASD)';

        //Проверяем есть ли в полученом тексте ключевые слова о листинге новой монеты и записываем значение true или false в переменную
        const checkIsListing = listingText.includes(listingOn.binance);

        //Проверяем не равна ли предыдущая новость с той что мы получаем в реальном времени, так как перезапускаем
        //эту функцию каждый 3 сек.
        //Если не равна переходим в следующий блок проверки, если равна, то через 3 сек. запускаем текущую функцию
        if (lastListingNews != listingText) {
            //Если в полученой новости есть сообщение о листинге мы переходим к следующему блоку
            if (checkIsListing) {

                const split = listingText.split(' '); //Делим строку по пробелам на масив слов

                //Запускаем цикл который находит название криптовалюты которую добавляют
                for (const item of split) {

                    const checkCryptoName = item.includes('('); //Находим название монеты и записываем её в переменую
                    //Проверяем название монеты, если переменная checkCryptoName равна true, то мы записываем в
                    //переменную cryptoListingName скоректированое название монеты
                    if (checkCryptoName) {
                        //Обрезаем все не нужное с названия монеты
                        cryptoListingName = item.substring(1, item.length - 1);
                        //Записываем в переменную lastListingNews текст который мы получаем на этой итерации
                        //при следующем вызове функции если мы получаем этот же текст, то мы не заходим в начальную проверку
                        // await bot.sendMessage(720663165, listingText);
                        lastListingNews = listingText;
                    }

                }

                //Сейчас в блоке который прошёл переверку на слова о листинге с текста который мы получили на этой итерации
                const checkMEXC = checkIfCoinOnFuturesInCryptoExchange(
                    `https://futures.mexc.com/exchange/${cryptoListingName}_USDT?type=linear_swap`,
                    MEXCTickerSelector,
                    cryptoListingName,
                    MEXC
                );


                const checkGateIo = checkIfCoinOnFuturesInCryptoExchange(
                    `https://www.gate.io/futures_trade/USDT/${cryptoListingName}_USDT`,
                    GateIoSelector,
                    cryptoListingName,
                    GateIo
                );


                const checkKuCoin = checkIfCoinOnFuturesInCryptoExchange(
                    `https://futures.kucoin.com/trade/${cryptoListingName}USDTM?spm=kcWeb.B1homepage.Header5.1`,
                    KuCoinSelector,
                    cryptoListingName,
                    KuCoin
                );

                // console.log('test')

                Promise.all([checkMEXC, checkGateIo, checkKuCoin]).then(cryptoCurrencyNameArray => {
                    sendMessageToTelegramUser(telegramID.hovvko, cryptoCurrencyNameArray, cryptoListingName, listingURL)
                })
            }
        }

        await browser.close();

    } catch (error) {
        if (error) {
            console.log(error);
        }
    }
}

//Функция которая проверяет есть ли монета на фьючерсах на указанной бирже
async function checkIfCoinOnFuturesInCryptoExchange(cryptoExchangeFuturesURL, selector, coinName, cryptoCurrencyName) {
    //Загрузка браузера, открытие новой вкладки та преход на страницу фьючерсов - передавая в URL динамично
    //название монеты, которое мы получили выше
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(cryptoExchangeFuturesURL);

    //Ждем пока загрузится нужный нам селектор
    await page.waitForSelector(selector);
    const tickerText = await page.$eval(selector, (element) => element['innerText']);
    // console.log(tickerText)

    const isNeedCoin = tickerText.includes(coinName);

    //Проверка есть ли такая монета на фьючерсах на указанной бирже если есть, то записать в переменную название биржи
    if (isNeedCoin) {
        await browser.close();
        return cryptoCurrencyName;
    } else {
        await browser.close();
        return null
    }
}

setInterval(() => {
    (async function () {
        return await parse(binanceListingNewsURL, BinanceNewsListingSelector);
    }())
}, 5000);

async function sendMessageToTelegramUser(userTelegramID, onFuturesArray, cryptoListingName, listingURL,) {
    const MEXCFuturesURL = `https://futures.mexc.com/exchange/${cryptoListingName}_USDT?type=linear_swap`;
    const GateIoFuturesURL = `https://www.gate.io/futures_trade/USDT/${cryptoListingName}_USDT`;
    const KuCoinFuturesURL = `https://futures.kucoin.com/trade/${cryptoListingName}USDTM?spm=kcWeb.B1homepage.Header5.1`;

    const telegramTextIfCoinTheresInFutures =
        `
✅ Листинг на - [Binance](${listingURL})

🚀 Монета - ${cryptoListingName}

Фьючерсы:
${onFuturesArray[0] ? (`[${onFuturesArray[0]}](${MEXCFuturesURL})`) : ''}
${onFuturesArray[1] ? (`[${onFuturesArray[1]}](${GateIoFuturesURL})`) : ''}
${onFuturesArray[2] ? (`[${onFuturesArray[2]}](${KuCoinFuturesURL})`) : ''}
`;

    const telegramTextIfCoinTheresInSpot =
`
✅ Листинг на - [Binance](${listingURL})

🚀 Монета - ${cryptoListingName}

Посмотреть где торгуется монета - [КЛИК](${coinMarketCapURL})
`;

    if (onFuturesArray[0] || onFuturesArray[1] || onFuturesArray[2]) {
        await bot.sendMessage(userTelegramID, telegramTextIfCoinTheresInFutures, {parse_mode: 'Markdown'});
    } else {
        await bot.sendMessage(userTelegramID, telegramTextIfCoinTheresInSpot, {parse_mode: 'Markdown'});
    }

}
