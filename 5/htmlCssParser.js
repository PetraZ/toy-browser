const css = require("css")
const layout = require("./layout.js")


const EOF = Symbol("EOF")

let letterReg = /^[a-zA-Z]$/
let spaceReg = /^[\t\n\f ]$/


class HTMLParser {
    constructor() {
        // always points to current parsing token
        this.currentToken = null
        this.currentAttribute = null


        // we use a stack to manage depth first search of dom
        // element: {type ... children ... attributes ...}
        this.stack = [{ type: "document", children: [] }];

        this.currentTextNode = null;

        this.rules = [];
    }



    parse = (s) => {
        let state = this._data
        for (let c of s) {
            state = state(c)
        }
        state(EOF)
        return this.stack[0]
    }

    // digest html data
    _data = (c) => {
        // tag start, end of html file or text node
        if (c === "<") { return this._tagOpen }
        if (c === EOF) {
            this._push_token({
                type: "EOF",
            })
            return;
        }
        // text node
        this._push_token({
            type: "text",
            value: c,
        })
        return this._data
    }

    _push_token = (token) => {

        // get top of the stack is current elemenet's context(parent)
        let top = this.stack[this.stack.length - 1];
        if (token.type === "startTag") {

            // create element and push it to the stack
            let element = {
                type: "element",
                attributes: [],
                children: [],
            }

            element.tagName = token.tagName;

            // add in all attributes
            for (let k in token) {
                if (k !== "type" && k !== "tagName") {
                    element.attributes.push({
                        name: k,
                        value: token[k],
                    })
                }
            }

            // check if we need to apply any rule onto this element, assume css rules have been added into tag atrributes
            this._computeCSS(element)

            top.children.push(element);
            element.parent = top;

            // is selfclosing we then should not push to stack(cause it ends directly)
            if (!token.isSelfClosing) {
                this.stack.push(element)
            }
            this.currentTextNode = null
            return;
        }
        if (token.type === "endTag") {
            if (token.tagName !== top.tagName) {
                throw new Error(`token tag name ${token.tagName} not equal to ${top.tagName}`)
            }
            // if token tag is style, then we need to parse it and add it into right place
            if (token.tagName === "style") {
                this._addCSSRule(top.children[0].value)
            }
            // we gotta know all the children relationship to do layout thus put he
            layout(top);
            this.stack.pop()
            this.currentTextNode = null
            return
        }
        if (token.type === "text") {
            if (this.currentTextNode === null) {
                this.currentTextNode = {
                    type: "text",
                    value: "",
                }
                top.children.push(this.currentTextNode)
            }
            this.currentTextNode.value += token.value
        }
    }

    _computeCSS = (element) => {
        // since css selector could contain comparison of parents and desendants
        // e.g. p a is targeting any <a> that sits inside a <p> element
        let parents = this.stack.slice().reverse();

        // after all we want to store all style declartinos into the right elements
        if (!element.computedStyle) {
            element.computedStyle = {};
        }

        // we then need to check all rules we have a rule is a selector, declarations pair
        for (let r of this.rules) {
            // deal with parent descendant selector like p a {}
            let selectorParts = r.selectors[0].split(" ").reverse()

            if (!this._match(element, selectorParts[0])) {
                // if current element not match then go to next rule
                continue
            }
            let matched = false
            let j = 1;
            for (let i = 0; i < parents.length; i++) {
                if (this._match(parents[i], selectorParts[j])) {
                    // p b a is matching p a selector
                    j++
                }
            }

            if (j >= selectorParts.length) {
                matched = true;
            }

            if (matched) {
                console.log("element ", element, "matches rule ", r)
                let sp = this._cal_specificity(r.selectors[0])
                // rule matches the current element, dec is like property:background-color value: blue   pair
                for (let dec of r.declarations) {
                    if (!element.computedStyle[dec.property]) {
                        element.computedStyle[dec.property] = {}
                    }
                    // what if there's overlapping properties here, we then use specificy to determine which one to show

                    if (!element.computedStyle[dec.property].specificity) {
                        element.computedStyle[dec.property].specificity = sp
                        element.computedStyle[dec.property].value = dec.value
                    } else if (this._compare_sp(sp, element.computedStyle[dec.property].specificity)) {
                        element.computedStyle[dec.property].specificity = sp
                        element.computedStyle[dec.property].value = dec.value
                    }
                }
            }
        }
    }

    _cal_specificity = (selector) => {
        // inline, id, class, tag
        let p = [0, 0, 0, 0]
        // assume all simple selectors here
        let selectorParts = selector.split(" ")
        for (let part of selectorParts) {
            if (part.charAt(0) == "#") {
                p[1] += 1
            } else if (part.charAt(0) == ".") {
                p[2] += 1
            } else {
                p[3] += 1
            }
        }
        return p
    }

    _compare_sp = (sp1, sp2) => {
        if (sp1[0] - sp2[0]) {
            return (sp1[0] - sp2[0]) > 0
        }
        if (sp1[1] - sp2[1]) {
            return (sp1[1] - sp2[1]) > 0
        }
        if (sp1[2] - sp2[2]) {
            return (sp1[2] - sp2[2]) > 0
        }
        return (sp1[3] - sp2[3]) > 0
    }


    _match = (element, selector) => {
        // assume selector is a simple selector here p .a #q
        if (!selector) {
            return false
        }

        if (selector[0] === ".") {
            // get all attributes of elements to find if there's a class attribute
            let classAttribute = element.attributes.filter((x) => x.name === "class")[0]
            return classAttribute && classAttribute.value === selector.slice(1)
        }
        if (selector[0] === "#") {
            let idAttribute = element.attributes.filter((x) => x.name === "id")[0]
            return idAttribute && idAttribute.value === selector.slice(1)
        }
        if (element.tagName === selector) {
            return true
        }
        return false
    }

    _addCSSRule = (text) => {
        let ast = css.parse(text)
        console.log(JSON.stringify(ast))
        this.rules.push(...ast.stylesheet.rules)
    }

    // allowed next: / and letter
    _tagOpen = (c) => {
        if (c === "/") return this._endTagOpen
        if (c.match(letterReg)) {
            this.currentToken = {
                type: "startTag",
                tagName: ""
            }
            return this._tagName(c)
        }
        throw new Error("in _tagOpen state, next char is neither / nor a letter")
    }

    // allowed next: letter
    _endTagOpen = (c) => {
        if (c.match(letterReg)) {
            this.currentToken = {
                type: "endTag",
                tagName: "",
            }
            return this._tagName(c)
        }
        throw new Error("in _endTagOpen state, next char is not letter")
    }

    // allowed next: letter, space, > and /
    _tagName = (c) => {
        if (c.match(letterReg)) {
            this.currentToken.tagName += c
            return this._tagName
        }
        if (c.match(spaceReg)) { return this._beforeAttributeName }
        if (c === ">") { return this._tagClosed(c) }
        if (c === "/") { return this._selfClosingTagOpen }

        throw new Error(`In _tagName having ${c}`)
    }

    // allowed next: space, letter, > and /
    _beforeAttributeName = (c) => {
        if (c.match(spaceReg)) { return this._beforeAttributeName }
        if (c.match(letterReg)) {
            this.currentAttribute = {
                name: "",
                value: "",
            }
            return this._attributeName(c)
        }
        if (c === ">") { return this._tagClosed(c) }
        if (c === "/") { return this._selfClosingTagOpen }

        throw new Error(`In _beforeAttributeName having ${c}`)
    }

    // allowed next: letter, space, =
    _attributeName = (c) => {
        if (c.match(letterReg)) {
            this.currentAttribute.name += c
            return this._attributeName
        }
        if (c.match(spaceReg)) { return this._afterAttributeName }
        if (c === "=") { return this._beforeAttributeValue }

        throw new Error(`In _attributeName having ${c}`)
    }

    // allowed next: = or space
    _afterAttributeName = (c) => {
        if (c.match(spaceReg)) { return this._afterAttributeName }
        if (c === "=") { return this._beforeAttributeValue }

        throw new Error(`In _afterAttributeName having ${c}`)
    }

    // allowed next: space, " or ', letter
    _beforeAttributeValue = (c) => {
        if (c.match(spaceReg)) { return this._beforeAttributeValue }
        if (c === `"`) { return this._doubleQuotedAttributeValue }
        if (c === `'`) { return this._singleQuotedAttributeValue }
        if (c.match(letterReg)) { return this._rawAttributeValue(c) }

        throw new Error(`In _beforeAttributeValue having ${c}`)
    }

    // allowed next: letter, space, >, /
    _rawAttributeValue = (c) => {
        if (c.match(letterReg)) {
            this.currentAttribute.value += c
            return this._rawAttributeValue
        }
        if (c.match(spaceReg)) {
            // add key val attributes into token
            this.currentToken[this.currentAttribute.name] = this.currentAttribute.value
            return this._beforeAttributeName
        }
        if (c === ">") {
            this.currentToken[this.currentAttribute.name] = this.currentAttribute.value
            return this._tagClosed(c)
        }
        if (c === "/") {
            this.currentToken[this.currentAttribute.name] = this.currentAttribute.value
            return this._selfClosingTagOpen
        }

        throw new Error(`In _rawAttributeValue having ${c}`)
    }

    // allowed next: any char besides single quote, single quote
    _singleQuotedAttributeValue = (c) => {
        if (c === `'`) {
            this.currentToken[this.currentAttribute.name] = this.currentAttribute.value
            return this._beforeAttributeName
        }
        this.currentAttribute.value += c
        return this._singleQuotedAttributeValue
    }

    // allowed next: any char besides double quote, double quote
    _doubleQuotedAttributeValue = (c) => {
        if (c === `"`) {
            this.currentToken[this.currentAttribute.name] = this.currentAttribute.value
            return this._beforeAttributeName
        }
        this.currentAttribute.value += c
        return this._doubleQuotedAttributeValue
    }

    // allowed next: > and space
    _selfClosingTagOpen = (c) => {
        if (c === ">") {
            this.currentToken.isSelfClosing = true
            return this._tagClosed(c)
        }
        if (c.match(spaceReg)) { return this._selfClosingTagOpen }

        throw new Error(`do not recognize char in _selfClosingTagOpen: ${c}`)
    }

    // tag end with >
    _tagClosed = (c) => {
        if (c === ">") {
            // push a complete tag to the stack
            this._push_token(this.currentToken)
            this.currentToken = null
            return this._data
        }

        throw new Error(`In _tagClosed having ${c}`)
    }
}



const testHTML = `<html lang="en">
<head></head>
<style>
  #box {
    width: 500px;
    height: 300px;
    background-color: rgb(255, 255, 255);
    display: flex;
  }
  #myid {
    background-color: rgb(255, 0, 0);
    width: 200px;
    height: 100px;
  }
  .c1 {
    background-color: rgb(0, 255, 0);
    flex: 1;
  }
</style>
<body>
  <div id="box">
    <div id="myid"></div>
    <div class="c1"></div>e
  </div>
</body>
</html>
`

let parser = new HTMLParser()
let dom = parser.parse(testHTML)
console.log(dom)
