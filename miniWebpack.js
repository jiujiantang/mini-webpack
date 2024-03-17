const fs = require('fs')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')
const path = require('path')

// 收集依赖
const getModuleInfo = (file) => {
    const body = fs.readFileSync(file, 'utf-8')
    // AST语法树
    const ast = parser.parse(body, {
        sourceType: 'module' //ES模块
    })
    // 收集依赖
    const deps = {}
    traverse(ast,{
        ImportDeclaration({node}){
            const dirname = path.dirname(file);
            const adspath = './' + path.join(dirname, node.source.value);
            deps[node.source.value] = adspath;
        }
    })

    const {code} = babel.transformFromAst(ast,null,{
        presets:["@babel/preset-env"]
    })

    const moduleInfo = {file, deps, code}

    return moduleInfo;
}

// 加载文件
const parseModules = (file) => {
    const entry = getModuleInfo(file)
    const temp = [entry]

    for (let i = 0; i < temp.length; i++) {
        const deps = temp[i].deps;
        if(deps) {
            // 循环加载
            for (const key in deps) {
                if (deps.hasOwnProperty(key)) {

                    temp.push(getModuleInfo(deps[key]))
                }
            }
        }
    }

    // 便于使用
    const depsGraph = {}
    temp.forEach( moduleInfo => {
        depsGraph[moduleInfo.file] = {
            deps: moduleInfo.deps,
            code: moduleInfo.code
        }
    })

    return depsGraph;
}

const bundle = (file) => {
    const depsGraph = JSON.stringify(parseModules(file))
    // 自执行，并处理require、exports上下文
    return`(function (graph) {
        function require(file) {
            function absRequire(relPath) {
                return require(graph[file].deps[relPath])
            }
            var exports = {};
            (function (require,exports,code) {
                eval(code)
            })(absRequire,exports,graph[file].code)
            return exports
        }
        require('${file}')
    })(${depsGraph})`   
}

const content = bundle('./src/index.js')
// 写入dist
fs.mkdirSync('./dist')
fs.writeFileSync('./dist/bundle.js',content)

