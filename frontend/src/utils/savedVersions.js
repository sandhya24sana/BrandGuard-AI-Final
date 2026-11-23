function toPositiveInteger(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function sameSavedId(left, right) {
  const normalizedLeft = toPositiveInteger(left);
  const normalizedRight = toPositiveInteger(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

export function getSavedVersions(versions, contentId) {
  const normalizedContentId = toPositiveInteger(contentId);
  if (!Array.isArray(versions) || normalizedContentId === null) return [];

  return versions
    .filter((version) => (
      version
      && sameSavedId(version.content_id, normalizedContentId)
      && toPositiveInteger(version.version_number) !== null
      && typeof version.text === 'string'
    ))
    .map((version) => ({
      ...version,
      content_id: normalizedContentId,
      version_number: toPositiveInteger(version.version_number),
    }))
    .sort((left, right) => left.version_number - right.version_number);
}
