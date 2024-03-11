const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");
require("dotenv").config();
const { verify } = require("../utils/verify");

const VRF_SUBSCRIPTION_FUND_AMOUNT = ethers.parseEther("30");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2Address, subscriptionId;

  const entranceFee = networkConfig[chainId]["entranceFee"];

  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target;

    const txResponse = await vrfCoordinatorV2Mock.createSubscription();
    const txReceipt = await txResponse.wait();
    subscriptionId = txReceipt.logs[0].args.subId;

    // Fund the subscription
    // Usually, you'd need the link token on a real network
    await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      VRF_SUBSCRIPTION_FUND_AMOUNT
    );
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  const keyHash = networkConfig[chainId]["keyHash"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];

  const args = [
    entranceFee,
    vrfCoordinatorV2Address,
    keyHash,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];

  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  log("Raffle deployed.");

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying contract...");
    await verify(raffle.address, args);
    log("Contract verified.");
    log("----------------------------------------------------------");
  }
};

module.exports.tags = ["all", "raffle"];
