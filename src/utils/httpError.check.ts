import { isRetryable, isTransient, statusOf } from "./httpError";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function failure(message: string): Error {
  return new Error(message);
}

// The native downloader only leaks the status through its message
assert(statusOf(failure("download failed, status: 429, url=...")) === 429, "reads a 429 out of the message");
assert(statusOf(failure("download failed, status: 503")) === 503, "reads a 5xx out of the message");
assert(statusOf(failure("SocketTimeoutException: timeout")) === null, "a socket error carries no status");
assert(statusOf("not an error") === null, "a non-error carries no status");

assert(isTransient(failure("java.net.SocketTimeoutException: failed to connect to /1.2.3.4")), "socket timeouts are transient");
assert(isTransient(failure("Unable to resolve host \"cdn.example\": No address associated")), "a dead host is transient");
assert(!isTransient(failure("javax.net.ssl.SSLHandshakeException: Trust anchor not found")), "a TLS failure is not transient");
assert(!isTransient(failure("HTTP 404")), "a plain status message is not transient");

assert(isRetryable(failure("status: 429 is not ok")), "429 is retried");
assert(isRetryable(failure("status: 503 is not ok")), "5xx is retried");
assert(isRetryable(failure("Connection reset by peer")), "a reset connection is retried");
assert(!isRetryable(failure("status: 404 is not ok")), "404 is not retried");
assert(!isRetryable(failure("status: 403 is not ok")), "403 is not retried");
assert(!isRetryable(failure("javax.net.ssl.SSLHandshakeException: Trust anchor")), "a refused certificate is not retried");
assert(!isRetryable(failure("something else entirely")), "an unknown failure is not retried");

console.log("http error rules ok");
