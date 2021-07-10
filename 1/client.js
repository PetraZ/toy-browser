const net = require('net');

class Request {
    constructor(params) {
        this.host = params.host
        this.port = params.port

        // method and path createa unique identifier for this server
        this.method = params.method || "GET"
        this.path = params.path || "/"

        this.headers = params.headers || {}
        this.body = params.body || {}

        if (!this.headers["Content-Type"]) {
            this.headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
        // only support two body content type here either json or urlencoded
        if (this.headers["Content-Type"] === "application/json")
            //obj -> str
            this.bodyText = JSON.stringify(this.body)

        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST just a encoding schema
        else if (this.headers["Content-Type"] === "application/x-www-form-urlencoded") {
            this.bodyText = Object.keys(this.body).map(key => { return `${key}=${encodeURIComponent(this.body[key])}` }).join("&")
        }
        this.headers["Content-Length"] = this.bodyText.length;
    }

    send(conn) {
        return new Promise((resolve, reject) => {
            console.log("send request is \n" + this.toString())
            if (conn) {
                conn.write(this.toString());
            } else {
                conn = net.createConnection({
                    host: this.host,
                    port: this.port
                }, () => {
                    conn.write(this.toString());
                })
            }
            conn.on("data", (data) => {
                console.log("response data is \n" + data.toString())

            })
            conn.on("error", (
                err) => {
                console.log(err)
                reject(err)
            }
            )
            resolve("")
            // conn.end();
        })
    }
    // example

    // POST / HTTP/1.1
    // header0: 0
    // Content-Type: application/x-www-form-urlencoded
    // Content-Length: 7

    // body0=0

    // convert current Request obj to ready to send requst string
    toString() {
        return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\r
\r
${this.bodyText}`
    }
}
void async function () {
    let request = new Request({
        host: "localhost",
        port: "8088",
        method: "POST",
        path: "",
        headers: { "header0": 0 },
        body: { "body0": 0 }
    })
    let response = await request.send();
}()
