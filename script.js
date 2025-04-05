document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const nextStep1 = document.getElementById('nextStep1');
    const prevStep2 = document.getElementById('prevStep2');
    const nextStep2 = document.getElementById('nextStep2');
    const prevStep3 = document.getElementById('prevStep3');
    const newComparison = document.getElementById('newComparison');
    const autoMapBtn = document.getElementById('autoMapBtn');
    const resetMappingsBtn = document.getElementById('resetMappingsBtn');
    const mappingRows = document.getElementById('mappingRows');
    
    // Data variables
    let jsonA = null;
    let jsonB = null;
    let fieldMappings = {};
    let allFieldsA = [];
    let allFieldsB = [];

    // Navigation between steps
    nextStep1.addEventListener('click', processStep1);
    prevStep2.addEventListener('click', () => toggleSteps(step2, step1));
    nextStep2.addEventListener('click', processStep2);
    prevStep3.addEventListener('click', () => toggleSteps(step3, step2));
    newComparison.addEventListener('click', resetTool);
    autoMapBtn.addEventListener('click', autoMapFields);
    resetMappingsBtn.addEventListener('click', resetMappings);

    // File upload handlers
    document.getElementById('fileA').addEventListener('change', handleFileUpload);
    document.getElementById('fileB').addEventListener('change', handleFileUpload);

    function handleFileUpload(event) {
        // When a file is uploaded, clear the corresponding clipboard input
        const fileId = event.target.id;
        const clipboardId = fileId.replace('file', 'clipboard');
        document.getElementById(clipboardId).value = '';
    }

    function toggleSteps(hideStep, showStep) {
        hideStep.classList.remove('active');
        showStep.classList.add('active');
        window.scrollTo(0, 0);
    }

    function processStep1() {
        // Get inputs from both sources
        const fileA = document.getElementById('fileA').files[0];
        const fileB = document.getElementById('fileB').files[0];
        const clipboardA = document.getElementById('clipboardA').value.trim();
        const clipboardB = document.getElementById('clipboardB').value.trim();

        // Process Source A
        if (fileA) {
            readFile(fileA).then(data => {
                jsonA = parseJSON(data);
                processSourceB(fileB, clipboardB);
            }).catch(error => {
                showError(`Error reading File A: ${error.message}`);
            });
        } else if (clipboardA) {
            try {
                jsonA = parseJSON(clipboardA);
                processSourceB(fileB, clipboardB);
            } catch (error) {
                showError(`Error parsing Clipboard A: ${error.message}`);
            }
        } else {
            showError('Please provide input for Source A');
            return;
        }
    }

    function processSourceB(fileB, clipboardB) {
        // Process Source B
        if (fileB) {
            readFile(fileB).then(data => {
                jsonB = parseJSON(data);
                prepareFieldMapping();
            }).catch(error => {
                showError(`Error reading File B: ${error.message}`);
            });
        } else if (clipboardB) {
            try {
                jsonB = parseJSON(clipboardB);
                prepareFieldMapping();
            } catch (error) {
                showError(`Error parsing Clipboard B: ${error.message}`);
            }
        } else {
            showError('Please provide input for Source B');
            return;
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(new Error('File reading failed'));
            reader.readAsText(file);
        });
    }

    function parseJSON(data) {
        try {
            return JSON.parse(data);
        } catch (error) {
            // Try to clean the JSON (remove comments, trailing commas)
            const cleaned = data
                .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') // Remove comments
                .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
            return JSON.parse(cleaned);
        }
    }

    function showError(message) {
        alert(message); // In a production app, you might use a nicer alert system
    }

    function prepareFieldMapping() {
        // Extract all unique fields from both JSONs (3 levels deep)
        allFieldsA = [...new Set(extractKeys(jsonA, 3))].sort();
        allFieldsB = [...new Set(extractKeys(jsonB, 3))].sort();
        
        // Generate initial mappings
        autoMapFields();
        
        toggleSteps(step1, step2);
    }

    function extractKeys(obj, maxDepth, currentPath = '', depth = 1) {
        let keys = [];
        
        if (typeof obj !== 'object' || obj === null || depth > maxDepth) {
            return keys;
        }
        
        Object.keys(obj).sort().forEach(key => {
            const newPath = currentPath ? `${currentPath}.${key}` : key;
            keys.push(newPath);
            
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                keys = keys.concat(extractKeys(obj[key], maxDepth, newPath, depth + 1));
            }
        });
        
        return keys;
    }

    function autoMapFields() {
        fieldMappings = {};
        const usedFieldsB = new Set();
        
        // Matching phases in order of priority
        [
            // Phase 1: Exact matches (case sensitive)
            (a, b) => a === b,
            
            // Phase 2: Exact matches (case insensitive)
            (a, b) => a.toLowerCase() === b.toLowerCase(),
            
            // Phase 3: Last part matches (for nested fields)
            (a, b) => {
                const aParts = a.split('.');
                const bParts = b.split('.');
                return aParts[aParts.length - 1].toLowerCase() === bParts[bParts.length - 1].toLowerCase();
            },
            
            // Phase 4: Fuzzy matching with threshold
            (a, b) => {
                const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
                const threshold = Math.max(3, a.length / 2, b.length / 2);
                return distance <= threshold;
            }
        ].forEach(matcher => {
            allFieldsA.forEach(fieldA => {
                if (!fieldMappings[fieldA]) {
                    const match = allFieldsB.find(fieldB => 
                        !usedFieldsB.has(fieldB) && matcher(fieldA, fieldB)
                    );
                    
                    if (match) {
                        fieldMappings[fieldA] = match;
                        usedFieldsB.add(match);
                    }
                }
            });
        });
        
        renderMappingUI();
    }

    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    }

    function renderMappingUI() {
        mappingRows.innerHTML = '';
        
        // Create a set of already mapped B fields
        const mappedBFields = new Set(Object.values(fieldMappings));
        
        // Add mapped fields first (sorted by A field name)
        [...Object.entries(fieldMappings)]
            .sort(([a1], [a2]) => a1.localeCompare(a2))
            .forEach(([fieldA, fieldB]) => {
                addMappingRow(fieldA, fieldB, true);
            });
        
        // Add unmapped fields from A (sorted)
        allFieldsA
            .filter(fieldA => !fieldMappings[fieldA])
            .sort()
            .forEach(fieldA => {
                addMappingRow(fieldA, '', false);
            });
        
        // Add unmapped fields from B (that weren't mapped to any A field, sorted)
        allFieldsB
            .filter(fieldB => !mappedBFields.has(fieldB))
            .sort()
            .forEach(fieldB => {
                addMappingRow('', fieldB, false);
            });
    }

    function addMappingRow(fieldA, fieldB, isSuggested) {
        const row = document.createElement('div');
        row.className = 'mapping-row row';
        
        // Field A display
        const colA = document.createElement('div');
        colA.className = 'col-md-5 field-name';
        if (fieldA) {
            colA.textContent = fieldA;
        } else {
            colA.innerHTML = '<em class="text-muted">(unmapped)</em>';
        }
        
        // Mapping indicator
        const colMap = document.createElement('div');
        colMap.className = 'col-md-2 text-center map-to';
        colMap.innerHTML = '<i class="bi bi-arrow-right"></i>';
        
        // Field B selector
        const colB = document.createElement('div');
        colB.className = 'col-md-5';
        
        if (fieldA) {
            const select = createFieldBSelect(fieldA, fieldB, isSuggested);
            colB.appendChild(select);
        } else {
            const fieldBDisplay = document.createElement('div');
            fieldBDisplay.className = 'field-name';
            fieldBDisplay.textContent = fieldB;
            colB.appendChild(fieldBDisplay);
        }
        
        row.appendChild(colA);
        row.appendChild(colMap);
        row.appendChild(colB);
        
        mappingRows.appendChild(row);
    }

    function createFieldBSelect(fieldA, currentValue, isSuggested) {
        const container = document.createElement('div');
        container.className = 'select-container';
        
        const select = document.createElement('select');
        select.className = `form-select form-select-sm ${isSuggested ? 'suggested' : ''}`;
        select.dataset.fieldA = fieldA;
        
        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Not Mapped --';
        select.appendChild(emptyOption);
        
        // Add available B fields
        allFieldsB.forEach(fieldB => {
            const option = document.createElement('option');
            option.value = fieldB;
            option.textContent = fieldB;
            if (fieldB === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // Add change handler
        select.addEventListener('change', function() {
            if (this.value) {
                fieldMappings[fieldA] = this.value;
            } else {
                delete fieldMappings[fieldA];
            }
            renderMappingUI();
        });
        
        container.appendChild(select);
        return container;
    }

    function resetMappings() {
        fieldMappings = {};
        renderMappingUI();
    }

    function processStep2() {
        // Sort both JSONs alphabetically by keys (3 levels deep)
        jsonA = sortObjectKeys(jsonA, 3);
        jsonB = sortObjectKeys(jsonB, 3);
        
        // Perform comparison
        const { comparisonA, comparisonB, summary } = compareJSONs(jsonA, jsonB, fieldMappings);
        
        // Display results
        document.getElementById('resultA').innerHTML = syntaxHighlight(comparisonA);
        document.getElementById('resultB').innerHTML = syntaxHighlight(comparisonB);
        
        // Display summary with counts
        document.getElementById('matchedCount').textContent = summary.matched;
        document.getElementById('mismatchedCount').textContent = summary.mismatched;
        document.getElementById('missingCount').textContent = summary.missing;
        document.getElementById('unmappedCount').textContent = summary.unmapped;
        
        // Set alert class based on results
        const summaryElement = document.getElementById('summary');
        if (summary.mismatched + summary.missing + summary.unmapped > 0) {
            summaryElement.className = 'alert alert-warning';
        } else {
            summaryElement.className = 'alert alert-success';
        }
        
        toggleSteps(step2, step3);
    }

function syntaxHighlight(comparison) {
    if (typeof comparison !== 'object' || comparison === null) {
        return escapeHtml(JSON.stringify(comparison));
    }
    
    // Handle direct comparison objects (leaf nodes with match/mismatch/missing status)
    if (comparison.match !== undefined || comparison.__unmapped) {
        let className = '';
        let extraInfo = '';
        
        if (comparison.__unmapped) {
            className = 'unmapped';
            extraInfo = ' <span class="extra-info">(unmapped)</span>';
        } else if (comparison.match === true) {
            className = 'match';
        } else if (comparison.match === false) {
            className = 'mismatch';
            extraInfo = ` <span class="extra-info">(expected: ${escapeHtml(JSON.stringify(comparison.targetValue))})</span>`;
        } else if (comparison.match === null) {
            className = 'missing';
            extraInfo = ' <span class="extra-info">(missing)</span>';
        }
        
        return `<span class="${className}">${escapeHtml(JSON.stringify(comparison.value))}${extraInfo}</span>`;
    }
    
    // Handle arrays
    if (Array.isArray(comparison)) {
        if (comparison.length === 0) {
            return '[]';
        }
        
        const items = comparison.map(item => syntaxHighlight(item)).join(',\n');
        return `[\n  ${items.split('\n').join('\n  ')}\n]`;
    }
    
    // Handle objects
    const keys = Object.keys(comparison).filter(key => key !== '__unmapped');
    if (keys.length === 0) {
        return '{}';
    }
    
    const entries = keys.map(key => {
        const valueStr = syntaxHighlight(comparison[key]);
        return `"${escapeHtml(key)}": ${valueStr.split('\n').join('\n  ')}`;
    }).join(',\n');
    
    return `{\n  ${entries.split('\n').join('\n  ')}\n}`;
}


    function sortObjectKeys(obj, maxDepth, depth = 1) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj) || depth > maxDepth) {
            return obj;
        }
        
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = sortObjectKeys(obj[key], maxDepth, depth + 1);
        });
        
        return sorted;
    }

function markDifferences(source, target, mappings, sourceSide, sortedKeys, depth = 1, maxDepth = 3) {
    if (typeof source !== 'object' || source === null) {
        return source;
    }
    
    // When max depth is reached, compare as simple values
    if (depth > maxDepth) {
        const isEqual = JSON.stringify(source) === JSON.stringify(target);
        return {
            value: source,
            match: isEqual ? true : false,
            targetValue: isEqual ? undefined : target,
            isMapped: true
        };
    }
    
    if (Array.isArray(source)) {
        return source.map(item => markDifferences(item, null, mappings, sourceSide, null, depth + 1, maxDepth));
    }
    
    const result = {};
    
    // Make sure sortedKeys exists, if not, create them from source
    const keysToUse = sortedKeys || Object.keys(source).sort();
    
    // Use the sorted keys for consistent order
    keysToUse.forEach(key => {
        const value = source[key];
        const mappedKey = mappings[key];
        const isMapped = mappedKey !== undefined;
        let targetValue = undefined;
        
        if (isMapped && target) {
            targetValue = target[mappedKey];
        }
        
        if (typeof value === 'object' && value !== null) {
            result[key] = markDifferences(value, targetValue, mappings, sourceSide, null, depth + 1, maxDepth);
            if (!isMapped) {
                result[key].__unmapped = true;
            }
        } else {
            const targetExists = isMapped && target && targetValue !== undefined;
            
            if (targetExists) {
                if (value === targetValue) {
                    result[key] = {
                        value,
                        match: true,
                        isMapped
                    };
                } else {
                    result[key] = {
                        value,
                        match: false,
                        targetValue,
                        isMapped
                    };
                }
            } else {
                result[key] = {
                    value,
                    match: null, // Missing in target
                    isMapped
                };
            }
        }
    });
    
    return result;
}

    function compareJSONs(a, b, mappings) {
        // Convert mappings to a more usable format
        const aToBMap = {};
        const bToAMap = {};
        const mappedFieldsA = new Set();
        const mappedFieldsB = new Set();
        
        Object.entries(mappings).forEach(([keyA, keyB]) => {
            aToBMap[keyA] = keyB;
            bToAMap[keyB] = keyA;
            mappedFieldsA.add(keyA);
            mappedFieldsB.add(keyB);
        });
    
        // Create mapping order for consistent sorting
        const mappingOrder = Object.entries(mappings).map(([aKey, bKey]) => ({
            aKey,
            bKey
        }));
    
        // Get keys from both objects
        const keysA = Object.keys(a || {});
        const keysB = Object.keys(b || {});
    
        // Sort keys based on mapping order first, then alphabetically
        const sortedKeysA = sortKeysForComparison(a || {}, 'a', mappingOrder, mappedFieldsA);
        const sortedKeysB = sortKeysForComparison(b || {}, 'b', mappingOrder, mappedFieldsB);
    
        // Perform comparison with sorted keys and maximum depth of 3
        const comparisonA = markDifferences(a || {}, b || {}, aToBMap, 'a', sortedKeysA, 1, 3);
        const comparisonB = markDifferences(b || {}, a || {}, bToAMap, 'b', sortedKeysB, 1, 3);
    
        // Generate summary
        const summary = {
            matched: 0,
            mismatched: 0,
            missing: 0,
            unmapped: 0
        };
        
        countDifferences(comparisonA, summary);
        
        return { comparisonA, comparisonB, summary };
    }

    function sortKeysForComparison(obj, side, mappingOrder, mappedFields) {
        if (!obj) return [];
        
        const allKeys = Object.keys(obj).sort();
        
        // Separate mapped and unmapped keys
        const mappedKeys = [];
        const unmappedKeys = [];
        
        allKeys.forEach(key => {
            if (mappedFields.has(key)) {
                mappedKeys.push(key);
            } else {
                unmappedKeys.push(key);
            }
        });
        
        // Sort mapped keys based on mapping order
        if (side === 'a') {
            mappedKeys.sort((keyA, keyB) => {
                const indexA = mappingOrder.findIndex(m => m.aKey === keyA);
                const indexB = mappingOrder.findIndex(m => m.aKey === keyB);
                return indexA - indexB;
            });
        } else {
            mappedKeys.sort((keyB, keyC) => {
                const indexA = mappingOrder.findIndex(m => m.bKey === keyB);
                const indexB = mappingOrder.findIndex(m => m.bKey === keyC);
                return indexA - indexB;
            });
        }
        
        return [...mappedKeys, ...unmappedKeys];
    }
function markDifferences(source, target, mappings, sourceSide, sortedKeys) {
    if (typeof source !== 'object' || source === null) {
        return source;
    }
    
    if (Array.isArray(source)) {
        return source.map(item => markDifferences(item, null, mappings, sourceSide));
    }
    
    const result = {};
    
    // Make sure sortedKeys exists, if not, create them from source
    const keysToUse = sortedKeys || Object.keys(source).sort();
    
    // Use the sorted keys for consistent order
    keysToUse.forEach(key => {
        const value = source[key];
        const mappedKey = mappings[key];
        const isMapped = mappedKey !== undefined;
        let targetValue = undefined;
        
        if (isMapped && target) {
            targetValue = target[mappedKey];
        }
        
        if (typeof value === 'object' && value !== null) {
            result[key] = markDifferences(value, targetValue, mappings, sourceSide);
            if (!isMapped) {
                result[key].__unmapped = true;
            }
        } else {
            const targetExists = isMapped && target && targetValue !== undefined;
            
            if (targetExists) {
                if (value === targetValue) {
                    result[key] = {
                        value,
                        match: true,
                        isMapped
                    };
                } else {
                    result[key] = {
                        value,
                        match: false,
                        targetValue,
                        isMapped
                    };
                }
            } else {
                result[key] = {
                    value,
                    match: null, // Missing in target
                    isMapped
                };
            }
        }
    });
    
    return result;
}

    function deepEqual(a, b) {
        if (a === b) return true;
        
        if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
            return false;
        }
        
        const keysA = Object.keys(a).sort();
        const keysB = Object.keys(b).sort();
        
        if (keysA.length !== keysB.length) return false;
        
        for (let i = 0; i < keysA.length; i++) {
            if (keysA[i] !== keysB[i]) return false;
            if (!deepEqual(a[keysA[i]], b[keysB[i]])) return false;
        }
        
        return true;
    }

    
function countDifferences(comparison, summary) {
    if (typeof comparison !== 'object' || comparison === null) return;
    
    // Check if this is a direct comparison object
    if (comparison.match !== undefined) {
        if (comparison.match === true) {
            summary.matched++;
        } else if (comparison.match === false) {
            summary.mismatched++;
        } else if (comparison.match === null) {
            summary.missing++;
        }
        return;
    }
    
    // Check if this is an unmapped object
    if (comparison.__unmapped === true) {
        summary.unmapped++;
        return;
    }
    
    // Recursively count differences in nested objects/arrays
    Object.keys(comparison).forEach(key => {
        if (key !== '__unmapped') {
            const value = comparison[key];
            if (typeof value === 'object' && value !== null) {
                countDifferences(value, summary);
            }
        }
    });
}

    function escapeHtml(unsafe) {
        if (unsafe === undefined || unsafe === null) {
            return '';
        }
        // Convert to string if it's not already a string
        const str = String(unsafe);
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function resetTool() {
        // Reset form
        document.getElementById('fileA').value = '';
        document.getElementById('fileB').value = '';
        document.getElementById('clipboardA').value = '';
        document.getElementById('clipboardB').value = '';
        mappingRows.innerHTML = '';
        document.getElementById('resultA').innerHTML = '';
        document.getElementById('resultB').innerHTML = '';
        document.getElementById('summary').textContent = '';
        document.getElementById('summary').className = 'alert';
        
        // Reset data
        jsonA = null;
        jsonB = null;
        fieldMappings = {};
        allFieldsA = [];
        allFieldsB = [];
        
        // Go back to step 1
        toggleSteps(step3, step1);
    }
});