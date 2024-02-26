/*
Features:
1. Enter the lottery by paying some eth
2. Pick a random winner (verifiably random)
3. Winner to be selected every X minutes -> completely automated
4. Chainlink Oracles -> Randomness, Automated execution (Chainlink Keeper)

Steps:
1. Write code
2. Refactor code for gas optimization
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// imports
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

// custom errors
error Raffle__InsufficientFund();
error Raffle__TransferFailed();

contract Raffle is VRFConsumerBaseV2 {
    // state variables
    uint private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorV2;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    address private s_recentWinner;

    // events
    event RaffleEnter(address indexed player);
    event RequestedRandomWinner(uint indexed requestId);
    event WinnerPicked(address indexed winner);

    // constructor
    constructor(
        uint _entranceFee,
        address _vrfCoordinatorV2,
        bytes32 _keyHash,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit
    ) VRFConsumerBaseV2(_vrfCoordinatorV2) {
        i_entranceFee = _entranceFee;
        i_vrfCoordinatorV2 = VRFCoordinatorV2Interface(_vrfCoordinatorV2);
        i_keyHash = _keyHash;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
    }

    // setter functions
    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__InsufficientFund();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    function requestRandomWinner() external {
        uint requestId = i_vrfCoordinatorV2.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRandomWinner(requestId);
    }

    function fulfillRandomWords(
        uint,
        uint[] memory randomWords
    ) internal override {
        uint winnerIdx = randomWords[0] % s_players.length;
        address payable winner = s_players[winnerIdx];
        s_recentWinner = winner;
        (bool sent, ) = winner.call{value: address(this).balance}("");
        if (!sent) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(winner);
    }

    // getter functions
    function getEntranceFee() public view returns (uint) {
        return i_entranceFee;
    }

    function getPlayer(uint _idx) public view returns (address) {
        return s_players[_idx];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }
    // modifiers
}
