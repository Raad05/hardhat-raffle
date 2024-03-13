/**
Features:
1. Enter the lottery by paying some eth
2. Pick a random winner (verifiably random)
3. Winner to be selected every X minutes -> completely automated
4. Chainlink Oracles -> Randomness, Automated execution (Chainlink Keeper)
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// imports
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

// custom errors
error Raffle__InsufficientFund();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint currentBalance,
    uint numPlayers,
    uint raffleState
);

/**
 * @title  A simple Raffle Contract
 * @author Yamin Raad
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink Keeper
 */

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    // type declarations
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    // state variables
    uint private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorV2;
    bytes32 private immutable i_keyHash; // gasLane
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint private s_lastTimestamp;
    uint private immutable i_interval;

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
        uint32 _callbackGasLimit,
        uint _interval
    ) VRFConsumerBaseV2(_vrfCoordinatorV2) {
        i_entranceFee = _entranceFee;
        i_vrfCoordinatorV2 = VRFCoordinatorV2Interface(_vrfCoordinatorV2);
        i_keyHash = _keyHash;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        i_interval = _interval;
    }

    // setter functions
    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__InsufficientFund();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev
     * The function that the chainlink keeper nodes call
     * They look for the upkeepNeeded to return true. The following shoule be true for it:
     * 1. The time interval should be passed
     * 2. The lottery should have at least one player and some Eth
     * 3. The subscription is funded with link
     * 4. The lottery should be in an "open" state
     */

    function checkUpkeep(
        bytes memory
    ) public view override returns (bool upkeepNeeded, bytes memory) {
        bool timePassed = ((block.timestamp - s_lastTimestamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        bool isOpen = (s_raffleState == RaffleState.OPEN);

        upkeepNeeded = timePassed && hasPlayers && hasBalance && isOpen;
    }

    function performUpkeep(bytes calldata) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
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
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimestamp = block.timestamp;
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

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumwords() public pure returns (uint) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint) {
        return s_players.length;
    }

    function getLatestTimestamp() public view returns (uint) {
        return s_lastTimestamp;
    }

    function getRequestConfirmations() public pure returns (uint) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint) {
        return i_interval;
    }

    // modifiers
}
