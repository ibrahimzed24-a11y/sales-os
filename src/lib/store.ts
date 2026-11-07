const r = await dbCall<{ rows: unknown[]; total: number }>('GET', '/api/db/' + t + '?all=1&sort=createdAt&dir=asc&page=' + p, undefined, { silent: true });
