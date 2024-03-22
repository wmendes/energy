const EnergyTradeHub = artifacts.require("EnergyTradeHub");

module.exports = function (deployer) {
  deployer.deploy(EnergyTradeHub);
};
