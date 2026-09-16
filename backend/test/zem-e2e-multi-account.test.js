const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
require('dotenv').config();

const { pool } = require('../dist/database');
const { jwtSecret } = require('../dist/security/jwt');
const { permissionsFor } = require('../dist/security/rbac');
const app = require('../dist/app').default;

test('Parcours E2E multi-comptes Passager -> Conducteur -> Course (28 étapes)', async (t) => {
  if (!pool) {
    t.skip('Base de données non configurée');
    return;
  }

  // Création du serveur HTTP sur port éphémère
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (path, method = 'GET', body, token) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { status: res.status, ok: res.ok, data };
  };

  // IDs uniques pour le test
  const passengerId = randomUUID();
  const driverId = randomUUID();
  const passengerPhone = `+22899${Math.floor(100000 + Math.random() * 900000)}`;
  const driverPhone = `+22898${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    // Préparation des comptes dans la base de données
    await pool.query('INSERT INTO users(id, phone, password) VALUES($1, $2, $3)', [
      passengerId,
      passengerPhone,
      'hashpass',
    ]);
    await pool.query(
      `INSERT INTO profiles(id, user_id, qr_token, profile_type, first_name, last_name, birth_date, gender, nationality, blood_type)
       VALUES($1, $2, $3, 'STANDARD', 'Passager', 'Test', '01/01/1995', 'NC', 'Togo', 'O+')`,
      [randomUUID(), passengerId, randomUUID().slice(0, 8)]
    );
    await pool.query(`INSERT INTO user_roles(user_id, role_key) VALUES($1, 'citizen')`, [passengerId]);

    await pool.query('INSERT INTO users(id, phone, password) VALUES($1, $2, $3)', [
      driverId,
      driverPhone,
      'hashpass',
    ]);
    await pool.query(
      `INSERT INTO profiles(id, user_id, qr_token, profile_type, first_name, last_name, birth_date, gender, nationality, blood_type, is_zem)
       VALUES($1, $2, $3, 'STANDARD', 'Conducteur', 'Test', '01/01/1995', 'NC', 'Togo', 'O+', true)`,
      [randomUUID(), driverId, randomUUID().slice(0, 8)]
    );
    await pool.query(`INSERT INTO user_roles(user_id, role_key) VALUES($1, 'zem_driver')`, [driverId]);
    await pool.query(
      `INSERT INTO zem_driver_applications(user_id, status, identity_document, license_number, motorcycle_make, motorcycle_model, plate, work_zone)
       VALUES($1, 'approved', 'ID-TEST', 'PERMIS-TEST', 'YAMAHA', 'AG100', 'TG-TEST', 'Lomé')
       ON CONFLICT DO NOTHING`,
      [driverId]
    );

    // Jetons JWT
    const passengerToken = jwt.sign(
      { sub: passengerId, roles: ['citizen'], permissions: permissionsFor(['citizen']) },
      jwtSecret(),
      { expiresIn: '1h' }
    );
    const driverToken = jwt.sign(
      { sub: driverId, roles: ['zem_driver'], permissions: permissionsFor(['zem_driver']) },
      jwtSecret(),
      { expiresIn: '1h' }
    );

    let rideId;
    let offerId;

    // Étape 1: Le conducteur se met en ligne avec des coordonnées réelles à Lomé
    const step1 = await request(
      '/zem/location',
      'POST',
      {
        lat: 6.132,
        lng: 1.222,
        isOnline: true,
        accuracy: 10,
        heading: 90,
        speed: 0,
      },
      driverToken
    );
    assert.equal(step1.status, 200, 'Étape 1: mise en ligne conducteur');

    // Étape 2: Vérification de l’insertion de la position en base
    const step2 = await pool.query('SELECT * FROM zem_locations WHERE zem_id = $1', [driverId]);
    assert.equal(step2.rows.length, 1, 'Étape 2: position enregistrée en DB');
    assert.equal(step2.rows[0].is_online, true);

    // Étape 3: Rejet si distance <= 0
    const step3 = await request(
      '/zem/request',
      'POST',
      {
        originLat: 6.133,
        originLng: 1.223,
        destLat: 6.133,
        destLng: 1.223,
        distanceKm: 0,
        priceFcfa: 300,
      },
      passengerToken
    );
    assert.equal(step3.status, 400, 'Étape 3: rejet distance 0');

    // Étape 4: Rejet si distance > 250 km
    const step4 = await request(
      '/zem/request',
      'POST',
      {
        originLat: 6.133,
        originLng: 1.223,
        destLat: 9.5,
        destLng: 1.5,
        distanceKm: 300,
        priceFcfa: 20000,
      },
      passengerToken
    );
    assert.equal(step4.status, 400, 'Étape 4: rejet distance > 250km');

    // Étape 5: Le passager commande une course valide (2.5 km dans Lomé)
    const step5 = await request(
      '/zem/request',
      'POST',
      {
        originLat: 6.133,
        originLng: 1.223,
        destLat: 6.145,
        destLng: 1.235,
        distanceKm: 2.5,
        priceFcfa: 10, // Prix bas envoyé par le client pour tester le recalcul serveur
      },
      passengerToken
    );
    assert.equal(step5.status, 201, 'Étape 5: création de course');
    assert.ok(step5.data.ride, 'Étape 5: objet ride présent');
    rideId = step5.data.ride.id;

    // Étape 6: Vérification du calcul serveur du prix (minimum 300 FCFA)
    assert.equal(step5.data.ride.price_fcfa, 300, 'Étape 6: prix calculé avec autorité côté serveur');

    // Étape 7: Statut initial de la course = offered (ou searching)
    assert.ok(['offered', 'searching'].includes(step5.data.ride.status), 'Étape 7: statut initial');

    // Étape 8: Vérification en base de données de la création de la proposition
    const step8 = await pool.query(
      'SELECT * FROM ride_offers WHERE ride_id = $1 AND zem_id = $2',
      [rideId, driverId]
    );
    assert.equal(step8.rows.length, 1, 'Étape 8: offre créée en DB');
    offerId = step8.rows[0].id;
    assert.ok(['offered', 'pending'].includes(step8.rows[0].status), 'Étape 8: statut offre valide');

    // Étape 9: Le conducteur interroge les offres en cours
    const step9 = await request('/zem/offers/current', 'GET', undefined, driverToken);
    assert.equal(step9.status, 200, 'Étape 9: récupération des offres conducteur');
    assert.ok(step9.data.offers.some((o) => o.id === offerId), 'Étape 9: offre trouvée dans la liste');

    // Étape 10: Un utilisateur non autorisé ne peut pas répondre à l’offre
    const step10 = await request(
      `/zem/offers/${offerId}/respond`,
      'POST',
      { decision: 'accept' },
      passengerToken
    );
    assert.notEqual(step10.status, 200, 'Étape 10: passager ne peut accepter une offre zem');

    // Étape 11: Le conducteur accepte la proposition
    const step11 = await request(
      `/zem/offers/${offerId}/respond`,
      'POST',
      { decision: 'accept' },
      driverToken
    );
    assert.equal(step11.status, 200, 'Étape 11: acceptation de l’offre');
    assert.equal(step11.data.ride.status, 'accepted', 'Étape 11: statut devient accepted');

    // Étape 12: Vérification de l’affectation du zem_id
    assert.equal(step11.data.ride.zem_id, driverId, 'Étape 12: zem_id attribué');

    // Étape 13: Le passager consulte la course
    const step13 = await request(`/zem/rides/${rideId}`, 'GET', undefined, passengerToken);
    assert.equal(step13.status, 200);
    assert.equal(step13.data.ride.status, 'accepted');

    // Étape 14: Le conducteur commence l’approche (driver_en_route)
    const step14 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'driver_en_route' },
      driverToken
    );
    assert.equal(step14.status, 200);
    assert.equal(step14.data.ride.status, 'driver_en_route');

    // Étape 15: Le conducteur arrive sur place (driver_arrived)
    const step15 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'driver_arrived' },
      driverToken
    );
    assert.equal(step15.status, 200);
    assert.equal(step15.data.ride.status, 'driver_arrived');

    // Étape 16: Le conducteur ne peut pas démarrer tant que le passager n'est pas prêt
    const step16 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'start' },
      driverToken
    );
    assert.equal(step16.status, 409, 'Étape 16: interdiction start avant passenger_ready');

    // Étape 17: Le passager signale qu’il est prêt (passenger_ready)
    const step17 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'passenger_ready' },
      passengerToken
    );
    assert.equal(step17.status, 200);
    assert.equal(step17.data.ride.status, 'ready_to_start');

    // Étape 18: Le conducteur démarre la course (start)
    const step18 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'start' },
      driverToken
    );
    assert.equal(step18.status, 200);
    assert.equal(step18.data.ride.status, 'in_progress');

    // Étape 19: Transmission de télémétrie en cours de trajet
    const step19 = await request(
      '/zem/location',
      'POST',
      {
        lat: 6.138,
        lng: 1.228,
        isOnline: true,
        accuracy: 8,
        heading: 45,
        speed: 28,
      },
      driverToken
    );
    assert.equal(step19.status, 200);

    // Étape 20: Le passager consulte la dernière position de la course
    const step20 = await request(
      `/zem/rides/${rideId}/positions/latest`,
      'GET',
      undefined,
      passengerToken
    );
    assert.equal(step20.status, 200);
    assert.ok(step20.data.position, 'Étape 20: position active enregistrée');
    assert.equal(Number(step20.data.position.latitude), 6.138);

    // Étape 21: Discussion en direct — le passager envoie un message
    const clientMsgId = randomUUID();
    const step21 = await request(
      `/zem/rides/${rideId}/messages`,
      'POST',
      { body: 'Je vous vois, j’arrive', client_message_id: clientMsgId },
      passengerToken
    );
    assert.equal(step21.status, 201);
    assert.equal(step21.data.message.body, 'Je vous vois, j’arrive');

    // Étape 22: Test d’idempotence — renvoi avec le même client_message_id
    const step22 = await request(
      `/zem/rides/${rideId}/messages`,
      'POST',
      { body: 'Je vous vois, j’arrive', client_message_id: clientMsgId },
      passengerToken
    );
    assert.equal(step22.status, 201);
    assert.equal(step22.data.message.id, step21.data.message.id, 'Idempotence validée');

    // Étape 23: Le conducteur lit les messages
    const step23 = await request(`/zem/rides/${rideId}/messages`, 'GET', undefined, driverToken);
    assert.equal(step23.status, 200);
    assert.ok(step23.data.messages.some((m) => m.client_message_id === clientMsgId));

    // Étape 24: Accusé de lecture des messages
    const step24 = await request(
      `/zem/rides/${rideId}/messages/read`,
      'PATCH',
      {},
      driverToken
    );
    assert.equal(step24.status, 200);

    // Étape 25: Le conducteur signale la fin du trajet (driver_completed)
    const step25 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'driver_completed' },
      driverToken
    );
    assert.equal(step25.status, 200);
    assert.equal(step25.data.ride.status, 'driver_completed');

    // Étape 26: Le passager valide et confirme la fin (confirm_complete)
    const step26 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'confirm_complete' },
      passengerToken
    );
    assert.equal(step26.status, 200);
    assert.equal(step26.data.ride.status, 'completed');

    // Étape 27: Course terminée = immuable
    const step27 = await request(
      `/zem/rides/${rideId}/action`,
      'POST',
      { action: 'cancel' },
      passengerToken
    );
    assert.notEqual(step27.status, 200, 'Étape 27: une course terminée ne peut être annulée');

    // Étape 28: Vérification finale en base de données et clôture
    const step28 = await pool.query('SELECT status FROM rides WHERE id = $1', [rideId]);
    assert.equal(step28.rows[0].status, 'completed', 'Étape 28: statut completed persisté');
  } finally {
    // Nettoyage
    await new Promise((resolve) => server.close(resolve));
    try {
      if (rideId) {
        await pool.query('DELETE FROM ride_messages WHERE ride_id = $1', [rideId]);
        await pool.query('DELETE FROM ride_positions WHERE ride_id = $1', [rideId]);
        await pool.query('DELETE FROM ride_events WHERE ride_id = $1', [rideId]);
        await pool.query('DELETE FROM ride_offers WHERE ride_id = $1', [rideId]);
        await pool.query('DELETE FROM rides WHERE id = $1', [rideId]);
      }
      await pool.query('DELETE FROM zem_locations WHERE zem_id = $1', [driverId]);
      await pool.query('DELETE FROM zem_driver_applications WHERE user_id = $1', [driverId]);
      await pool.query('DELETE FROM user_roles WHERE user_id IN ($1, $2)', [passengerId, driverId]);
      await pool.query('DELETE FROM profiles WHERE user_id IN ($1, $2)', [passengerId, driverId]);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [passengerId, driverId]);
    } catch {
      // Ignorer erreur de nettoyage
    }
  }
});
