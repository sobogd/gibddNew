const { exit } = require('process');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
/**
 * Функция подготовки страницы для робота
 * @param {*} page 
 */
const preparePageForTests = async (page) => {
    // Pass the User-Agent Test.
    const userAgent = 'Mozilla/5.0 (X11; Linux x86_64)' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';
    await page.setUserAgent(userAgent);

    // Pass the Webdriver Test.
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    // Pass the Chrome Test.
    await page.evaluateOnNewDocument(() => {
        // We can mock this in as much depth as we need for the test.
        window.navigator.chrome = {
            runtime: {},
            // etc.
        };
    });

    // Pass the Permissions Test.
    await page.evaluateOnNewDocument(() => {
        const originalQuery = window.navigator.permissions.query;
        return window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    // Pass the Plugins Length Test.
    await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'plugins', {
            // This just needs to have `length > 0` for the current test,
            // but we could mock the plugins too if necessary.
            get: () => [1, 2, 3, 4, 5],
        });
    });

    // Pass the Languages Test.
    await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
    });
}
/**
 * Функция сна для имитации поведения
 * @param {*} ms 
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Функция получения текущего времени в милисекундах
 */
const ms = () => {
    var now = new Date();
    return Math.floor(now.getTime() / 1000);
}
/**
 * Заранее заданные переменные
 */
let result = { errors: [], info: { checkAutoHistory: {}, checkAutoAiusdtp: {}, checkAutoRestricted: {}, checkAutoWanted: {} } },
    timeout = 1600000,
    startTime = ms(),
    iPhone = puppeteer.devices['iPhone 8'];
/**
 * Функция по получению данныз по выбранному полю
 */
const getInformationAboutBlock = async function (id) {
    /**
     * Готовим браузер и страницу для запроса
     */
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.emulate(iPhone);
    await preparePageForTests(page);
    await page.setDefaultNavigationTimeout(timeout);
    /**
     * Имитируем поведение на сайте ГИБДД
     */
    try {
        await page.goto('https://xn--90adear.xn--p1ai/');
        await page.click('.bs-holder2 ul li:nth-child(1) a');
        await page.waitForTimeout(1000);
        await page.goto('https://xn--90adear.xn--p1ai/check/fines');
        await page.click('.bs-holder2 ul li:nth-child(2) a');
        await page.waitForTimeout(1000);
        await page.goto('https://xn--90adear.xn--p1ai/check/auto');
        await page.waitForTimeout(1000);
        await page.click('#checkAutoVIN');
    } catch (e) {
        result.errors.push(e);
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'открыта итоговая страница.png' });
    /**
     * Вводим ИНН по буквам
     */
    try {
        let vin = process.argv[2]
        for (n = 0; n < vin.length; n++) {
            await page.waitForTimeout(200);
            try {
                await page.type('#checkAutoVIN', vin[n]);
            } catch (e) {
                result.errors.push(e);
                break;
            }
        }
        await page.screenshot({ path: 'ввели вин номер.png' });
    } catch (e) {
        result.errors.push(e);
    }
    /**
     * Нажимаем на кнопку выбранного информационного блока
     */
    try {
        await page.click('#' + id + ' a');
    } catch (e) {
        result.errors.push(e);
    }
    /**
     * Ждем что выдаст сервер
     */
    while (true) {
        try {
            let statusHtml = await page.$eval('#' + id + '', e => e.innerHTML);
            let modalBody = await page.$eval('body', e => e.innerHTML);
            if (statusHtml.indexOf('Выполняется запрос, ждите') + 1 && modalBody.indexOf('div class="adds-modal"') < 0) {
                console.log(`Прошло ${ms() - startTime} секунд`);
            } else {
                await page.screenshot({ path: 'темп.png', fullPage: true });
                break;
            }
            await page.waitForTimeout(100);
        } catch (e) {
            result.errors.push(e);
            break;
        }
    }
    /**
     * Получаем статус ответа сервера
     */
    try {
        await page.screenshot({ path: 'ответ сервера.png' });
        let statusText = await page.$eval('#' + id + ' .check-message', e => e.innerHTML);
        if (statusText.indexOf('Выполняется запрос, ждите') + 1) {
            result.status = 'success';
        } else {
            result.status = 'failed';
            result.info[id]['description'] = statusText;
            return false;
        }
    } catch (e) {
        result.errors.push(e);
    }
    /**
     * Кликаем по рекламе или видеоролику, чтобы его скрыть
     */
    try {
        await page.waitForTimeout(10000);
        await page.click('.adds-modal');
        await page.click('.close_modal_window');
    } catch (e) {}
    /**
     * Получаем содержимое HTML и раскладываем его по полочкам
     */
    try {
        let checkAutoHistory = await page.$eval('#' + id + '', e => e.innerHTML);
        checkAutoHistory = cheerio.load(checkAutoHistory);
        checkAutoHistory('ul.fields-list li').each(function (i, elem) {
            result.info[id][checkAutoHistory(this).children().first().text().replace(':', '').replace(' ', '_').replace(' ', '_').replace(' ', '_').replace(' ', '_').replace(' ', '_').replace(' ', '_').replace(' ', '_')] = checkAutoHistory(this).children().last().text()
        });
    } catch (e) {
        result.errors.push(e);
    }
    /**
     * Если не заполнена информация - выводим что ее нету
     */
    if(JSON.stringify(result.info[id])==='{}'){
        result.info[id]['description'] = 'Информация не найдена!';
    }
    /**
     * Закрываем сессию
     */
    await browser.close();
}
/**
 * Общая функция обещания с сайта ГИБДД
 */
const getInformation = function () {
    return new Promise(async function (resolve, reject) {
        /**
         * Делаем таймаут для соединения с сайтом ГИБДД, в случае недоступности сайта
         */
        setTimeout(function () {
            result.status = 'failed';
            result.errors.push('Истекло время ожидание ответа сайта ГИБДД.');
            reject();
        }, timeout)
        /**
         * Получаем из запроса нужные для показа блоки информации
         */



        /**
         * Для всех выбранных блоков собираем информацию (пока только для reg)
         */
        await getInformationAboutBlock('checkAutoHistory');
        await getInformationAboutBlock('checkAutoAiusdtp');
        await getInformationAboutBlock('checkAutoRestricted');
        await getInformationAboutBlock('checkAutoWanted');
        /**
         * Завершаем обещание
         */
        resolve(result);
    });
}
/**
 * Вызываем обещание с выбранным таймаутом сервиса ГИБДД
 */
getInformation().then(function () {
    console.log(result);
    exit();
}).catch(function () {
    console.log(result);
    exit();
});