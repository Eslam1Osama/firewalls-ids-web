importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

onmessage = async function(e) {
    console.log('[Worker] Message received from main script');
    const { sectionsData } = e.data;
    const zip = new JSZip();

    for (const section of sectionsData) {
        const { id, imgDataUrl } = section;
        // Extract base64 data from Data URL
        const imgDataBase64 = imgDataUrl.split(',')[1];
        zip.file(`${id}.jpeg`, imgDataBase64, { base64: true });
        console.log(`[Worker] Added ${id}.jpeg to ZIP.`);
    }

    try {
        const blob = await zip.generateAsync({ type: 'blob' });
        console.log('[Worker] ZIP file generated.');
        postMessage({ status: 'complete', blob: blob });
    } catch (error) {
        console.error('[Worker] Error generating ZIP:', error);
        postMessage({ status: 'error', message: error.message });
    }
}; 