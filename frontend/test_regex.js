
const content = `Here is some text.
?? **Thinking Process:**
> I am thinking
> about this
> multiline thing

And here is more text.
?? **Web Search Thinking:**
> Searching...
> Found it!`

const regex = /((?:?? \*\*Thinking Process:\*\*|?? \*\*Web Search Thinking:\*\*)\n(?:> .*(?:\n|$))+)/g
const parts = content.split(regex)
console.log(parts)

