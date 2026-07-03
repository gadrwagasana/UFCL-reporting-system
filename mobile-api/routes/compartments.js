'use strict';
const router = require('express').Router();
const data   = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const VIEW_ROLES   = ['admin', 'ceo', 'operations', 'supervisor'];
const CREATE_ROLES = ['admin', 'ceo', 'operations', 'supervisor'];
const MANAGE_ROLES = ['admin', 'ceo', 'operations'];

router.get('/', requireRoles(VIEW_ROLES), async (req, res) => {
  const result = await data.compartmentsList(req.user.id);
  if (!result.ok) return respond(res, result);
  const rows = result.rows || [];
  const metrics = {
    total:            rows.length,
    active:           rows.filter(r => r.status === 'Active').length,
    totalAreaHa:      rows.reduce((s, r) => s + Number(r.area_ha  || 0), 0),
    totalVolumeM3:    rows.reduce((s, r) => s + Number(r.volume_m3 || 0), 0),
    totalHarvestedM3: rows.reduce((s, r) => s + Number(r.volume_harvested_m3 || 0), 0),
  };
  respond(res, { ok: true, rows, metrics }, 60);
});

router.post('/', requireRoles(CREATE_ROLES), async (req, res) => {
  const result = await data.compartmentsCreate(req.user.id, req.body);
  respond(res, result);
});

router.put('/:id', requireRoles([...MANAGE_ROLES, 'supervisor']), async (req, res) => {
  if (req.user.role === 'supervisor') {
    const editResult = await data.pendingEditsCreate(req.user.id, {
      action_type: 'edit',
      entity_type: 'compartment',
      entity_id:   Number(req.params.id),
      entity_ref:  req.body.compt_name || '',
      payload:     req.body,
    });
    if (!editResult.ok) return respond(res, editResult);
    return respond(res, { ok: true, pendingApproval: true, message: 'Edit submitted for manager approval.' });
  }
  const result = await data.compartmentsUpdate(req.user.id, Number(req.params.id), req.body);
  respond(res, result);
});

router.delete('/:id', requireRoles([...MANAGE_ROLES, 'supervisor']), async (req, res) => {
  if (req.user.role === 'supervisor') {
    const delResult = await data.deletionRequestCreate(req.user.id, {
      tableName:  'compartments',
      recordId:   Number(req.params.id),
      entityType: 'compartment',
      entityRef:  req.body.entityRef || '',
      reason:     req.body.reason,
    });
    if (!delResult.ok) return respond(res, delResult);
    return respond(res, { ok: true, pendingApproval: true, message: 'Deletion request submitted for manager approval.' });
  }
  const result = await data.compartmentsDelete(req.user.id, Number(req.params.id), req.body.reason);
  respond(res, result);
});

module.exports = router;
