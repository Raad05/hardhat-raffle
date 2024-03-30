const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Test:", async function () {
      let raffle, entranceFee, deployer, accounts;

      beforeEach(async function () {
        accounts = await ethers.getSigners();
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract("Raffle", deployer);
        entranceFee = await raffle.getEntranceFee();
      });

      describe("fullfillRandomWords:", function () {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
          // enter the raffle
          const startingTimestamp = await raffle.getLatestTimestamp();

          await new Promise(async (resolve, reject) => {
            // setup listener before we enter the raffle
            // just in case the blockchain moves really fast
            raffle.once("WinnerPicked", async () => {
              console.log("WinnerPicked event triggered.");
              try {
                // add our asserts here
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance = await accounts[0].getBalance();
                const endingTimestamp = await raffle.getLatestTimestamp();

                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState, 0);
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(entranceFee).toString()
                );
                assert(endingTimestamp > startingTimestamp);
                resolve();
              } catch (e) {
                console.log(e);
                reject(e);
              }
            });
            // then entering the raffle
            await raffle.enterRaffle({ value: entranceFee });
            const winnerStartingBalance = await accounts[0].getBalance();
            // and this code won't stop until the listener has finished listening
          });
        });
      });
    });
