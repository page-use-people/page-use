const fs = require('node:fs');
const path = require('node:path');

module.exports = (request, options) => {
    if (request.startsWith('.') && request.endsWith('.mjs')) {
        const mtsRequest = request.replace(/\.mjs$/, '.mts');
        const candidatePath = path.resolve(options.basedir, mtsRequest);

        if (fs.existsSync(candidatePath)) {
            return options.defaultResolver(mtsRequest, options);
        }
    }

    return options.defaultResolver(request, options);
};
