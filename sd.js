const mongoose = require('mongoose');
const _ = require('lodash');
const { TablePosition, Table } = require('../models');
const { status } = require('../utils/constant');
const { throwBadRequest } = require('../utils/badRequestHandlingUtils');
const { getMessageByLocale } = require('../locale');

const createTablePosition = async (tablePositionRequestBody) => {
  const body = { name: tablePositionRequestBody.tablePositionName, restaurantId: tablePositionRequestBody.restaurantId };
  const tablePosition = await TablePosition.findOne({ ...body, status: status.enabled });
  throwBadRequest(tablePosition, getMessageByLocale({ key: 'tablePositionMsg.existed' }));
  const createdTablePosition = await TablePosition.create(body);
  // update table with existed position name
  await Table.updateMany(
    { position: tablePositionRequestBody.tablePositionName },
    {
      $set: {
        tablePositionId: createdTablePosition._id,
      },
    },
    { multi: true }
  );
};

const getTablePositionByRestaurantId = async ({ restaurantId }) => {
  const filter = { restaurantId, status: status.enabled };
  const tablePositions = await TablePosition.find(filter);
  return _.orderBy(tablePositions, 'name');
};

const updateTablePosition = async (tablePositionRequestBody) => {
  const tablePosition = await TablePosition.findOne({
    restaurantId: mongoose.Types.ObjectId(tablePositionRequestBody.restaurantId),
    name: tablePositionRequestBody.tablePositionName,
    status: status.enabled,
  });
  if (tablePositionRequestBody.tablePositionId !== tablePosition._id.toString()) {
    throwBadRequest(tablePosition, getMessageByLocale({ key: 'tablePositionMsg.existed' }));
  }
  let { enableTableCleanupFeature } = tablePositionRequestBody;
  if (!enableTableCleanupFeature) {
    enableTableCleanupFeature = false;
  }
  await TablePosition.findByIdAndUpdate(
    tablePositionRequestBody.tablePositionId,
    {
      name: tablePositionRequestBody.tablePositionName,
      status: tablePositionRequestBody.status,
      enableTableCleanupFeature,
    },
    {
      new: true,
      runValidators: true,
      context: 'query',
    }
  );
  // update position in table
  if (tablePositionRequestBody.tablePositionName) {
    await Table.updateMany(
      {
        restaurantId: mongoose.Types.ObjectId(tablePositionRequestBody.restaurantId),
        tablePositionId: mongoose.Types.ObjectId(tablePositionRequestBody.tablePositionId),
      },
      {
        $set: {
          position: tablePositionRequestBody.tablePositionName,
        },
      }
    );
  }
};

const deleteTablePosition = async (tablePositionId) => {
  const tablesCount = await Table.countTablesInTablePosition(tablePositionId);
  throwBadRequest(tablesCount > 0, getMessageByLocale({ key: 'tablePositionMsg.notEmpty' }));
  await TablePosition.updateOne(
    { _id: tablePositionId },
    {
      status: status.disabled,
    }
  );
};

module.exports = {
  createTablePosition,
  getTablePositionByRestaurantId,
  deleteTablePosition,
  updateTablePosition,
};
