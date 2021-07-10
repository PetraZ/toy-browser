
// this file serves as a simple server && return response to http requests
const http = require("http")

const returnBody = `<html a=b>
<head d=c>
</head>
<style>
    body div {
        background: red;
    }
</style>
<body>
    <div class='introText'>hello world</div>
</body>
</html>
`

http.createServer((request, response) => {
    let body = [];
    request.
        on('error', (err) => { console.error(err); }).
        on('data', (chunk) => { body.push(chunk); }).
        on('end', () => {
            body = Buffer.concat(body).toString()
            // log reqeust body
            console.log("request header: ", request.headers)
            console.log("request body:", body)

            response.writeHead(200, { 'Content-Type': 'text/html' })
            response.end(returnBody)
        });
}).listen(8088);

console.log("server has started")
