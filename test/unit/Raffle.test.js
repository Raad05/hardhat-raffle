const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Test:", async function () {
      let raffle, vrfCoordinatorV2Mock, entranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture("all");
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        entranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });

      describe("constructor:", function () {
        it("initializes the raffle contract correctly", async function () {
          // Ideally each 'it' has just 1 assert. But ok
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("enterRaffle:", function () {
        it("reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.rejectedWith(
            "Raffle__InsufficientFund"
          );
        });

        it("records players when they enter", async function () {
          await raffle.enterRaffle({ value: entranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it("emits event on enter", async function () {
          await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
            raffle,
            "RaffleEnter"
          );
        });

        it("doesn't allow entrance when raffleState is calculating", async function () {
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);

          await network.provider.request({
            method: "evm_mine",
            params: [],
          });
          // Pretend to be a chainlink Keeper
          await raffle.performUpkeep("0x");
          await expect(
            raffle.enterRaffle({ value: entranceFee })
          ).to.be.rejectedWith("Raffle__NotOpen");
        });
      });

      describe("checkUpkeep:", function () {
        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert(!upkeepNeeded);
        });

        it("returns false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep("0x");
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed", async function () {
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) - 5,
          ]);
          await network.provider.request({
            method: "evm_mine",
            params: [],
          });
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert(!upkeepNeeded);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) - 1,
          ]);
          await network.provider.request({
            method: "evm_mine",
            params: [],
          });
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep:", function () {
        it("it can run if only checkUpkeep is true", async function () {
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await raffle.checkUpkeep("0x");
          assert(tx);
        });

        it("reverts when checkUpkeep is false", async function () {
          await expect(raffle.performUpkeep("0x")).to.be.rejectedWith(
            "Raffle__UpkeepNotNeeded"
          );
        });

        it("updates the raffle state, calls the VRF coordinator and emits an event", async function () {
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep("0x");
          const txReceipt = await txResponse.wait();
          const requestId = txReceipt.logs[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert(Number(requestId) > 0);
          assert(Number(raffleState) === 1);
        });
      });

      describe("fulfillRandomWords:", function () {
        beforeEach(async function () {
          await raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });

        it("can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target)
          ).to.be.revertedWith("nonexistent request");
        });

        it("picks a winner, resets the lottery, and sends money", async function () {
          const additionalEntrants = 3;
          const startingIdx = 1; // since deployerIdx = 0
          for (let i = startingIdx; i < additionalEntrants + startingIdx; i++) {
            const accountConnectedRaffle = raffle.connect(accounts[1]);
            await accountConnectedRaffle.enterRaffle({ value: entranceFee });
          }

          const startingTime = await raffle.getLatestTimestamp();

          // performUpkeep (mock being chainlink Keepers)
          // fulfillRandomWords (mock begin chainlink VRF)
          // we will have to wait for the fulfillRandomWords to be called
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", () => {
              try {
              } catch (err) {}
              resolve();
            });
            // setting up the listener
            // below we will fire the event, and the listener will pick it up, and resolve
            const txResponse = await raffle.performUpkeep("0x");
            const txReceipt = await txResponse.wait();
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.logs[1].args.requestId,
              raffle.target
            );
          });
        });
      });
    });
