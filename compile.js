'use strict';

const Epub = require('epub-gen');
const acquit = require('acquit');
const archiver = require('archiver');
const cheerio = require('cheerio');
const highlight = require('highlight.js');
const fs = require('fs');
const marked = require('marked');
const nightmare = require('nightmare');
const transform = require('acquit-require');

require('acquit-ignore')();

marked.setOptions({
  highlight: function(code) {
    return highlight.highlight('JavaScript', code).value;
  }
});

run().catch(error => console.error(error.stack));

async function run() {
  const blank = fs.readFileSync('./content/blank.html', 'utf8');
  const cover = fs.readFileSync('./content/cover.html', 'utf8');
  const dedication = fs.readFileSync('./content/dedication.html', 'utf8');
  const intro = fs.readFileSync('./content/intro.md', 'utf8');
  const outro = fs.readFileSync('./content/outro.md', 'utf8');
  const toc = fs.readFileSync('./content/toc.md', 'utf8');

  const examples = [1, 2, 3, 4].
    map(c => fs.readFileSync(`./examples/chapter${c}.test.js`, 'utf8').toString());

  const chapters = [1, 2, 3, 4].
    map(c => fs.readFileSync(`./content/chapter${c}.md`, 'utf8').toString()).
    map((c, i) => transform(c, examples[i]));

  await compileEpub(intro, chapters, outro);

  const css = {
    content: fs.readFileSync('./content/content.css', 'utf8'),
    cover: fs.readFileSync('./content/cover.css', 'utf8'),
    dedication: fs.readFileSync('./content/dedication.css', 'utf8')
  };

  const coverHtml = `
    <link href='http://fonts.googleapis.com/css?family=Titillium+Web' rel='stylesheet' type='text/css'>
    <link href='http://fonts.googleapis.com/css?family=Roboto' rel='stylesheet' type='text/css'>
    <link href='http://fonts.googleapis.com/css?family=Droid+Sans+Mono' rel='stylesheet' type='text/css'>
    <style>
      ${css.cover}
    </style>
    <div id="content">
      ${cover}
    </div>
  `;

  const contentHtml = `
    <html>
      <head>
        <link href='http://fonts.googleapis.com/css?family=Titillium+Web' rel='stylesheet' type='text/css'>
        <link href='http://fonts.googleapis.com/css?family=Roboto' rel='stylesheet' type='text/css'>
        <link href='http://fonts.googleapis.com/css?family=Droid+Sans+Mono' rel='stylesheet' type='text/css'>

        <meta http-equiv="content-type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <style>
          ${css.content}
        </style>
      </head>
      <body>
        <div class="toc">
          ${marked(toc)}
        </div>
        <div class="chapter">
          ${marked(intro)}
        </div>
        <div class="chapter">
          ${marked(chapters[0])}
        </div>
        <div class="chapter">
          ${marked(chapters[1])}
        </div>
        <div class="chapter">
          ${marked(chapters[2])}
        </div>
        <div class="chapter">
          ${marked(chapters[3])}
        </div>
        <div class="chapter">
          ${marked(outro)}
        </div>
      </body>
    </html>
  `;

  const dedicationHtml = `
    <link href='http://fonts.googleapis.com/css?family=Titillium+Web' rel='stylesheet' type='text/css'>
    <link href='http://fonts.googleapis.com/css?family=Roboto' rel='stylesheet' type='text/css'>
    <link href='http://fonts.googleapis.com/css?family=Droid+Sans+Mono' rel='stylesheet' type='text/css'>
    <style>
      ${css.dedication}
    </style>
    <div id="content">
      ${dedication}
    </div>
  `;

  fs.writeFileSync('./bin/cover.html', coverHtml);
  fs.writeFileSync('./bin/content.html', contentHtml);
  fs.writeFileSync('./bin/dedication.html', dedicationHtml);

  let browser = nightmare({ show: false });

  await browser.goto(`file://${__dirname}/bin/cover.html`).
    pdf('./bin/cover.pdf', { marginsType: 0 });

  await browser.goto(`file://${__dirname}/bin/content.html`).
    pdf('./bin/content.pdf', { marginsType: 0 });

  await browser.goto(`file://${__dirname}/bin/dedication.html`).
    pdf('./bin/dedication.pdf', { marginsType: 0 });

  console.log('Done');
  process.exit(0);
}

async function compileEpub(intro, chapters, conclusion) {
  intro = marked(stripFirstLine(intro));
  chapters = chapters.
    map(stripFirstLine).
    map(ch => marked(ch));
  conclusion = marked(stripFirstLine(conclusion));

  chapters[1] = chapters[1].replace(/<svg[\s\S]+<\/svg>/m,
    '<img src="https://i.imgur.com/wemS4Ws.png" />');

  chapters[2] = chapters[2].replace('../images/flow.png',
    'https://i.imgur.com/UyRLFTS.jpg');

  for (let i = 0; i < chapters.length; ++i) {
    const $ = cheerio.load(chapters[i]);
    $('.example-header-wrap').next('pre').children().
      append(i => `<div class="example-footer">${$('.example-header').eq(i).html()}</div>`);
    chapters[i] = $.html();
  }

  const options = {
    title: 'Mastering Async/Await',
    author: 'Valeri Karpov',
    output: `${process.cwd()}/bin/mastering-async-await.epub`,
    cover: `${process.cwd()}/images/cover.jpg`,
    content: [
      { title: 'How To Use This Book', data: intro },
      { title: 'Async/Await: The Good Parts', data: chapters[0] },
      { title: 'Promises From The Ground Up', data: chapters[1] },
      { title: 'Async/Await Internals', data: chapters[2] },
      { title: 'Async/Await in the Wild', data: chapters[3] },
      { title: 'Moving On', data: conclusion }
    ],
    css: fs.readFileSync('./content/epub.css', 'utf8')
  };
  await new Epub(options).promise;
}

function stripFirstLine(str) {
  const firstNewLine = str.indexOf('\n');
  if (firstNewLine === -1) {
    return '';
  }
  return str.substr(firstNewLine + 1);
}
