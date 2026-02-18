export const AUDIO_CHUNK_TIMESLICE_MS = 30 * 1000;
export const MAX_AUDIO_CHUNK_BYTES = 24 * 1024 * 1024;
export const DEFAULT_AUDIO_CHUNK_MIME_TYPE = 'audio/webm';
export const OPENAI_TRANSCRIPTION_MAX_BYTES = 25 * 1024 * 1024;
const AUDIO_CHUNK_MIME_TYPE_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
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
export function buildAudioChunkFilename(recordingId, index) {
    return `recording_${recordingId}_audio_${String(index).padStart(4, '0')}.webm`;
}
