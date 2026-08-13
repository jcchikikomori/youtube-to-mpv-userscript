export { MpvHandlerClient } from './baseline/MpvHandlerClient.js';
export {
  MpvHandlerError,
  MpvHandlerHttpError,
  MpvHandlerResponseError,
  MpvHandlerTimeoutError,
  MpvHandlerUnreachableError,
} from './baseline/errors.js';
export type { MpvHandlerClientOptions, PlayOptions } from './baseline/types.js';

export { AbstractVideoSource } from './contracts/AbstractVideoSource.js';
export { InvalidVideoInputError } from './contracts/errors.js';
export type { OpenOptions, OpenResult, VideoSource } from './contracts/VideoSource.js';

export { VideoSourceRegistry } from './registry.js';

export { YoutubeSource } from './platforms/youtube/index.js';
