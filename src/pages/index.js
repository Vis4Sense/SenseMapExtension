$(function() {
    // Data
    var data = chrome.extension.getBackgroundPage().data = { nodes: [], links: [] }, // background page allows to share data across views
        actions = [], // All actions added in temporal order including 'revisit' and 'child' actions
        browser = sm.provenance.browser(),
        mod = sm.provenance.mod(),
        pendingTasks = {}, // For jumping to an action when its page isn't ready yet
        closeConfirmation = false,
        // datasetName = '';
        datasetName = 'data/test3.zip';

    // Vis and options
    var collection,
        listening = true;

    respondToContentScript();
    run();

    function run() {
        // Always listening now for easy testing
        listening = true;

        if (datasetName) {
            // Load data
            if (datasetName.endsWith('.json')) {
                d3.json(datasetName, data => {
                    loadWorkspace(data, true);
                    main();
                });
            } else {
                JSZipUtils.getBinaryContent(datasetName, (err, data) => {
                    loadWorkspace(data);
                    main();
                });
            }
        } else {
            main();
        }

        initSettings();

        // openCurationView();

        // d3.select('body').on('mouseover', function() {
        //     chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, {
        //         focused: true
        //     });
        // });
    }

    function initSettings() {
        // Show/hide settings
        d3.select('#bars').on('click', toggleToolbar);

        d3.select('#btnNew').on('click', () => {
            actions = [];
            data.nodes = [];
            data.links = [];
            browser.actions(actions, function() {
                redraw();
                toggleToolbar();
            });
        });

        d3.select('#btnSave').on('click', function() {
            saveWorkspace();
            toggleToolbar();
        });

        $('#btnLoad').click(e => {
            $(this).val(null);
        });
        $('#btnLoad').change(e => {
            sm.readUploadedFile(e, content => {
                loadWorkspace(content, false, true);
                redraw();
                toggleToolbar();
            }, true);
        });

        d3.select('#btnReplay').on('click', function() {
            replay(1000);
            toggleToolbar();
        });

        d3.select('#btnFrezze').on('click', function() {
            collection.frozen(true);
            toggleToolbar();
        });

        d3.select('#btnCurate').on('click', function() {
            collection.curated(!collection.curated());
            d3.select(this).text(collection.curated() ? 'Select' : 'Pan');
        });

        // Need confirmation when close/reload collection
        if (closeConfirmation) {
            window.onbeforeunload = function() {
                return "All unsaved data will be gone if you close this window.";
            };
        }
    }

    function toggleToolbar() {
        d3.select('.btn-toolbar').classed('hide', !d3.select('.btn-toolbar').classed('hide'));
    }

    function openCurationView() {
        var url = chrome.extension.getURL('src/pages/curation-view.html');
        var view = chrome.extension.getViews().find(v => v.location.href === url);

        if (!view) {
            chrome.windows.create({
                url: url,
                type: "popup",
                left: 0,
                top: 0,
                width: screen.width / 2,
                height: screen.height
            }, function() {
                chrome.runtime.sendMessage({ type: 'data', value: data });
            });
        }
    }

    function main() {
        browser.actions(actions, function() {
            buildVis();
            updateVis();
        }).capture()
        .on('dataChanged', _.throttle(onDataChanged, 200));
    };

    function onDataChanged(p) {
        // console.log(p, +new Date());
        mod.mergeActions(actions);
        redraw();
    }

    function loadWorkspace(content, isJson, external) {
        var zip;

        if (isJson) {
            actions = content.data;
        } else {
            zip = new JSZip(content);
            actions = JSON.parse(zip.file('sensemap.json').asText()).data;
        }

        mod.mergeActions(actions);

        if (!isJson) replaceRelativePathWithDataURI(zip);

        if (external) {
            browser.actions(actions, function() {
                if (collection) redraw();
            });
        }
    }

    function replaceRelativePathWithDataURI(zip) {
        _.forEach(zip.files, f => {
            if (f.dir || f.name === 'sensemap.json') return;

            var a = actions.find(a => a.image === f.name.split('/')[1]);
            if (a) {
                // Don't use blob: it makes it unable to resave image file
                // a.image = URL.createObjectURL(new Blob([zip.file(f.name).asArrayBuffer()], { type : 'image/png' }));
                var bf = zip.file(f.name).asArrayBuffer();
                a.image = 'data:image/png;base64,' + btoa([].reduce.call(new Uint8Array(bf), (p, c) => p + String.fromCharCode(c), ''));
            }
        });
    }

    function respondToContentScript() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (!listening) return;

            var tab = sender.tab;

            if (request.type === 'requestData') {
                // Get highlights, notes for the requested item
                sendResponse(actions.filter(d => d.url === tab.url).map(getCoreData));
            } else if (request.type === 'requestTask') {
                if (pendingTasks[tab.id]) {
                    sendResponse(getCoreData(pendingTasks[tab.id]));
                    delete pendingTasks[tab.id];
                }
            } else if (request.type === 'focusWindow') {
                chrome.windows.update(tab.windowId, { focused: true });
            } else if (request.type === 'redraw') {
                redraw(true);
            } else if (request.type === 'actionAdded') {
                onActionAdded(request.value);
            }
        });
    }

    function buildVis() {
        collection = sm.vis.collection()
            .label(d => d.text)
            .icon(d => d.favIconUrl);

        mod.on('redrawn', redraw)
            .on('actionAdded', onActionAdded)
            .on('nodeClicked', onNodeClicked)
            .handleEvents(collection);

        $(window).resize(_.throttle(updateVis, 200));

        d3.select('#btnCurate').text(collection.curated() ? 'Select' : 'Pan');
    }

    function saveWorkspace() {
        var zip = new JSZip();

        // Images: replace dataURL with local files to reduce the size of main file
        var coreData = actions.map(getCoreData);
        coreData.filter(d => d.image).forEach(d => {
            if (d.image.startsWith('data')) {
                var filename = d.id + '.png';
                // base64 data doesn't have 'data:image/png;base64,'
                zip.folder('images').file(filename, d.image.split('base64,')[1], { base64: true });
                d.image = filename;
            }
        });

        // Main file
        zip.file('sensemap.json', JSON.stringify({ data: coreData }, null, 4));

        // Zip and download
        var filename = d3.time.format('%Y%m%d%H%M%S')(new Date()) + '-sensemap.zip';
        sm.saveDataToFile(filename, zip.generate({ type: 'blob' }), false, true);
    }

    function getCoreData(d) {
        var c = {},
            fields = [ 'id', 'text', 'url', 'type', 'time', 'endTime', 'favIconUrl', 'image', 'classId', 'path', 'from',
            'seen', 'favorite', 'minimized', 'removed', 'removedTime', 'sourceId', 'targetId' ];

        fields.forEach(f => {
            if (d[f] !== undefined) c[f] = d[f];
        });

        return c;
    }

    function replay(timeStep) {
        var count = 1,
            relevantActions = actions.filter(a => a.type !== 'click-node' && a.type !== 'revisit');

        var intervalId = setInterval(() => {
            console.log(relevantActions[count].type);
            mod.mergeActions(relevantActions.slice(0, count));
            redraw();
            count++;

            if (count === relevantActions.length) clearInterval(intervalId);
        }, timeStep);
    }

    function updateVis() {
        collection.width(window.innerWidth).height(window.innerHeight);
        redraw();
    }

    function redraw(external) {
        d3.select('.sm-collection-container').datum(data).call(collection);

        if (!external) chrome.runtime.sendMessage({ type: 'redraw' });
    }

    function onActionAdded(d) {
        actions.push(d);
    }

    function onNodeClicked(d) {
        chrome.tabs.query({}, tabs => {
            var tab = tabs.find(t => t.url === d.url);
            if (tab) {
                // Found it, tell content script to scroll to the element
                chrome.tabs.update(tab.id, { active: true });
                chrome.tabs.sendMessage(tab.id, { type: 'scrollToElement', path: d.path, image: d.image });

                // Get the tab/window in focused as well
                chrome.windows.update(tab.windowId, { focused: true });
            } else {
                // Can't find it, already closed, open new item, request scrolling later on
                chrome.tabs.create({ url: d.url }, tab => {
                    chrome.windows.update(tab.windowId, { focused: true });
                    pendingTasks[tab.id] = d;
                });
            }
        });
    }
});