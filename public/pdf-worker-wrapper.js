// Polyfill Promise.withResolvers for environments that lack it (e.g., older Chromium builds)
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// Load the actual pdf.js worker (copied to the same folder)
import './pdf.worker.min.js'
