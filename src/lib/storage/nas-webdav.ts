import "server-only";

import { Buffer } from "node:buffer";
import {
  request as httpsRequest,
  type RequestOptions as HttpsRequestOptions,
} from "node:https";
import type { IncomingMessage } from "node:http";

const DEFAULT_TIMEOUT_MS = 120_000;

type NasWebDavConfig = {
  endpoint: URL;
  username: string;
  password: string;
  rootSegments: string[];
  timeoutMs: number;
  rejectUnauthorized: boolean;
  ca?: string;
};

export class NasWebDavError extends Error {
  readonly code: string;
  readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = "NasWebDavError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new NasWebDavError(
      `Missing server environment variable: ${name}`,
      "CONFIG_MISSING",
    );
  }
  return value;
}

function safeSegments(path: string) {
  const segments = path.split("/").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  ) {
    throw new NasWebDavError("Invalid NAS storage path", "INVALID_PATH");
  }
  return segments;
}

function getConfig(): NasWebDavConfig {
  const endpoint = new URL(requiredEnvironment("NAS_WEBDAV_URL"));
  if (endpoint.protocol !== "https:") {
    throw new NasWebDavError(
      "NAS_WEBDAV_URL must use HTTPS",
      "CONFIG_INVALID",
    );
  }

  const timeoutInput = Number(process.env.NAS_WEBDAV_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutInput)
    ? Math.min(Math.max(timeoutInput, 5_000), 300_000)
    : DEFAULT_TIMEOUT_MS;
  const ca = process.env.NAS_WEBDAV_CA_CERT?.replaceAll("\\n", "\n").trim();

  return {
    endpoint,
    username: requiredEnvironment("NAS_WEBDAV_USERNAME"),
    password: requiredEnvironment("NAS_WEBDAV_PASSWORD"),
    rootSegments: safeSegments(process.env.NAS_WEBDAV_ROOT ?? "/德馨星云"),
    timeoutMs,
    rejectUnauthorized:
      process.env.NAS_WEBDAV_TLS_REJECT_UNAUTHORIZED !== "false",
    ca: ca || undefined,
  };
}

function resourceUrl(config: NasWebDavConfig, relativeSegments: string[]) {
  const url = new URL(config.endpoint);
  const endpointSegments = url.pathname.split("/").filter(Boolean);
  const segments = [
    ...endpointSegments,
    ...config.rootSegments,
    ...relativeSegments,
  ];
  url.pathname = `/${segments.map(encodeURIComponent).join("/")}`;
  url.search = "";
  url.hash = "";
  return url;
}

function requestWebDav(
  config: NasWebDavConfig,
  method: string,
  relativeSegments: string[],
  options: {
    body?: Buffer;
    headers?: Record<string, string>;
  } = {},
) {
  const url = resourceUrl(config, relativeSegments);
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(
      `${config.username}:${config.password}`,
    ).toString("base64")}`,
    ...options.headers,
  };
  if (options.body) headers["Content-Length"] = String(options.body.byteLength);

  const requestOptions: HttpsRequestOptions = {
    method,
    headers,
  };
  if (url.protocol === "https:") {
    requestOptions.rejectUnauthorized = config.rejectUnauthorized;
    if (config.ca) requestOptions.ca = config.ca;
  }

  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = httpsRequest(url, requestOptions, resolve);

    request.setTimeout(config.timeoutMs, () => {
      request.destroy(
        new NasWebDavError("NAS request timed out", "REQUEST_TIMEOUT"),
      );
    });
    request.on("error", (error) => {
      reject(
        error instanceof NasWebDavError
          ? error
          : new NasWebDavError("NAS request failed", "REQUEST_FAILED"),
      );
    });
    request.end(options.body);
  });
}

function discardResponse(response: IncomingMessage) {
  return new Promise<void>((resolve, reject) => {
    response.resume();
    response.on("end", resolve);
    response.on("error", reject);
  });
}

async function ensureDirectories(
  config: NasWebDavConfig,
  storageSegments: string[],
) {
  const parentSegments = storageSegments.slice(0, -1);
  for (let index = 1; index <= parentSegments.length; index += 1) {
    const response = await requestWebDav(
      config,
      "MKCOL",
      parentSegments.slice(0, index),
    );
    const status = response.statusCode ?? 0;
    await discardResponse(response);
    if ((status < 200 || status >= 300) && status !== 405) {
      throw new NasWebDavError(
        "Unable to prepare NAS directory",
        "MKCOL_FAILED",
        status,
      );
    }
  }
}

export async function uploadNasFile(
  storagePath: string,
  contents: Buffer,
  contentType: string,
) {
  const config = getConfig();
  const storageSegments = safeSegments(storagePath);
  await ensureDirectories(config, storageSegments);

  const response = await requestWebDav(config, "PUT", storageSegments, {
    body: contents,
    headers: {
      "Content-Type": contentType,
      "If-None-Match": "*",
    },
  });
  const status = response.statusCode ?? 0;
  await discardResponse(response);
  if (status < 200 || status >= 300) {
    throw new NasWebDavError(
      "Unable to upload file to NAS",
      "UPLOAD_FAILED",
      status,
    );
  }
}

export async function deleteNasFile(storagePath: string) {
  const config = getConfig();
  const response = await requestWebDav(
    config,
    "DELETE",
    safeSegments(storagePath),
  );
  const status = response.statusCode ?? 0;
  await discardResponse(response);
  if ((status < 200 || status >= 300) && status !== 404) {
    throw new NasWebDavError(
      "Unable to remove file from NAS",
      "DELETE_FAILED",
      status,
    );
  }
}

export async function downloadNasFile(storagePath: string, range?: string) {
  const config = getConfig();
  const response = await requestWebDav(
    config,
    "GET",
    safeSegments(storagePath),
    range ? { headers: { Range: range } } : undefined,
  );
  const status = response.statusCode ?? 0;
  if (status !== 200 && status !== 206) {
    await discardResponse(response);
    throw new NasWebDavError(
      status === 404 ? "NAS file not found" : "Unable to download file from NAS",
      status === 404 ? "FILE_NOT_FOUND" : "DOWNLOAD_FAILED",
      status,
    );
  }

  return response;
}
