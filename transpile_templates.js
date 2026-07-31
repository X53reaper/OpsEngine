const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function transpileDir(srcDir, outDir) {
    if (!fs.existsSync(srcDir)) return;
    fs.mkdirSync(outDir, { recursive: true });
    
    for (const file of fs.readdirSync(srcDir)) {
        if (!file.endsWith('.ts')) continue;
        const src = path.join(srcDir, file);
        const dst = path.join(outDir, file.replace('.ts', '.js'));
        const content = fs.readFileSync(src, 'utf8');
        const result = ts.transpileModule(content, {
            compilerOptions: { 
                module: ts.ModuleKind.CommonJS, 
                target: ts.ScriptTarget.ES2020,
                esModuleInterop: true
            }
        });
        fs.writeFileSync(dst, result.outputText);
        console.log('OK:', path.relative('/app/src', src));
    }
}

// Transpile main services
transpileDir('/app/src/services', '/app/dist/services');

// Transpile email-templates subdirectory
transpileDir('/app/src/services/email-templates', '/app/dist/services/email-templates');

console.log('Done!');
