/** Check MP4 container boundaries before creating a Bunny video. This reads only atom headers. */
export async function validateVideoFile(file: Blob & { name: string }): Promise<void> {
  if (!/\.(mp4|m4v|mov)$/i.test(file.name)) return;

  let offset = 0;
  let hasMovieMetadata = false;
  let hasMediaData = false;

  while (offset + 8 <= file.size) {
    const header = new DataView(await file.slice(offset, offset + 16).arrayBuffer());
    let atomSize = header.getUint32(0);
    const atomType = String.fromCharCode(...new Uint8Array(header.buffer, 4, 4));
    let headerSize = 8;

    if (atomSize === 1) {
      if (header.byteLength < 16) throw invalidMp4Error();
      const extendedSize = header.getBigUint64(8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) throw invalidMp4Error();
      atomSize = Number(extendedSize);
      headerSize = 16;
    } else if (atomSize === 0) {
      atomSize = file.size - offset;
    }

    if (atomSize < headerSize || offset + atomSize > file.size) throw invalidMp4Error();
    if (atomType === "moov") hasMovieMetadata = true;
    if (atomType === "mdat") hasMediaData = true;
    offset += atomSize;
  }

  if (offset !== file.size || !hasMovieMetadata || !hasMediaData) throw invalidMp4Error();
}

function invalidMp4Error(): Error {
  return new Error("Видео имеет повреждённую структуру MP4/MOV: не удалось прочитать данные воспроизведения. Проверьте файл локально или экспортируйте его заново перед загрузкой.");
}
