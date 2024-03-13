const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Test:", async function () {
      let raffle, vrfCoordinatorV2Mock;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        const { deployer } = await getNamedAccounts();
        await deployments.fixture("all");
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
      });
      describe("Constructor:", async function () {
        it("initializes the raffle contract correctly", async function () {
          // Ideally each 'it' has just 1 assert. But ok
          const raffleState = await raffle.getRaffleState();
          const interval = await raffle.getInterval();
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });
    });
