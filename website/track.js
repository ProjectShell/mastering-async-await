var xhr = new XMLHttpRequest();
xhr.open('POST', 'https://g0a3nbw0xa.execute-api.us-east-1.amazonaws.com/prod/track', true);

xhr.setRequestHeader('Content-Type', 'application/json');

xhr.onreadystatechange = function() {};
xhr.send(JSON.stringify({
  path: window.location.pathname,
  hostname: window.location.hostname
}));
