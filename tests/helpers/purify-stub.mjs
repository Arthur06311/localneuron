const DOMPurify = {
  sanitize(html) {
    return String(html ?? '');
  },
};

export default DOMPurify;
