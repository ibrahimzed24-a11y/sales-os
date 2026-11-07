  return ['acc', 'con', 'deal', 'act', 'prod', 'quote', 'pb'].includes(prefix) ? crypto.randomUUID() : `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
