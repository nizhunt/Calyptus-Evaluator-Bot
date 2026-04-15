// -----------------------------------------------------------------------
// Audio chunk constants
// -----------------------------------------------------------------------
export const AUDIO_CHUNK_TIMESLICE_MS = 30 * 1000;
export const MAX_AUDIO_CHUNK_BYTES = 24 * 1024 * 1024;
export const DEFAULT_AUDIO_CHUNK_MIME_TYPE = 'audio/webm';
export const OPENAI_TRANSCRIPTION_MAX_BYTES = 25 * 1024 * 1024;

// -----------------------------------------------------------------------
// Video / recording constants
// -----------------------------------------------------------------------
export const VIDEO_TIMESLICE_MS = 5000;
export const VIDEO_BITRATE_BPS = 2_500_000;
export const AUDIO_COLLECTION_TIMEOUT_MS = 15_000;
export const TRANSCRIPT_MAX_CHARS = 500_000;

const AUDIO_CHUNK_MIME_TYPE_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=aac',
    'audio/mp4',
];
export function getSupportedAudioChunkMimeType() {
    if (typeof MediaRecorder === 'undefined') {
        return '';
    }
    for (const mimeType of AUDIO_CHUNK_MIME_TYPE_CANDIDATES) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return mimeType;
        }
    }
    return '';
}
export function buildAudioChunkFilename(recordingId, index, mimeType) {
    const ext = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm';
    return `recording_${recordingId}_audio_chunk_${String(index).padStart(3, '0')}.${ext}`;
}
