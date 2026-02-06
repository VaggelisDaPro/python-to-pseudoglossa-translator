# Python to Γλωσσα/Ψευδογλωσσα translator
### DISCLAIMER
> This project was made as a tool to help translate Python to either of the languages. It is not a tool that is always 100% accurate and if there isn't enough info from the code to determine correct typings, there isn't much I can do. Always verify your code is what you want in the end (type checks, etc.). 
## Overview
This project is a tool that allows for the quick conversion of Python code to Γλωσσα or Ψευδογλωσσα, albeit with some limitations. It's a tool used to visualize what Python code would look like in either of the two languages, **but provides code that will run on either interpreter.** You can find an online interpreter for both [Γλωσσα](https://gloglossa.gr) and [Ψευδογλωσσα](https://pseudo.gloglossa.gr).

## Features
- Translation of Python to both languages. (+adaptation)
- No download needed. Can be used in your [web](https://vaggelisdapro.github.io/).
- Custom algorithm name from a simple variable `ALG_NAME`.
- Automatic type identification for Γλωσσα.
- F-String support for `print()` statements.
- Save to file.

### Custom Naming
Since both programming languages require you to name your algorithm, I decided to be *user friendly* and give you an option in your code to decide that name. You can create a variable named `ALG_NAME` and assign a value to it, albeit with some understandable limitations.
```py
ALG_NAME = 'my_algorithm'
```
- Your name cannot start with a number
- Your name cannot match the name of any function
- Your name cannot include special characters
- Your name cannot include spaces, they must be replaced with `_` (underscores)

These are all limitations imposed on by the programming languages and not by me. I just enforce them.
If you're handy, here is the regex that does the check.
`/^[\p{Script=Latin}\p{Script=Greek}0-9_]+$/u`

## Limitations
These limitations come from Γλωσσα/Ψευδογλωσσα lack of features and not directly from the tool.
- No library support. {`math` library is an exception}
- Only simple Python can be translated.
- F-String support in variables is not available.
- Functions arent't available in Ψευδογλωσσα (they are in Γλωσσα though).

## License
> This project is source-available and intended as an educational tool. The author retains full copyright. Redistribution or claiming authorship without permission is not allowed.

> I am not affiliated with, endorsed by, or the owner of any of the online interpreters mentioned in this README.