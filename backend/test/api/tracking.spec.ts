import { expect, test } from '@playwright/test';

test('public tracking rejects an unknown code without exposing private fields', async ({
  request,
}) => {
  const response = await request.get('/api/public/track/LM_NOT_FOUND');

  expect(response.status()).toBe(404);
  const body = JSON.parse(await response.text()) as unknown;
  expect(typeof body).toBe('object');
  expect(body).not.toHaveProperty('receiverPhone');
  expect(body).not.toHaveProperty('receiverAddress');
  expect(body).not.toHaveProperty('senderId');
});

test('fee quote is computed from a real API request', async ({ request }) => {
  const response = await request.post('/api/parcels/calculate-fee', {
    data: {
      weightKg: 2,
      senderLat: 10.776,
      senderLng: 106.701,
      receiverLat: 10.823,
      receiverLng: 106.629,
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = JSON.parse(await response.text()) as {
    currency?: unknown;
    fee?: unknown;
  };
  expect(body.currency).toBe('VND');
  expect(typeof body.fee).toBe('number');
  expect(body.fee as number).toBeGreaterThan(0);
});
