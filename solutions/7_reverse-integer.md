# 7. Reverse Integer

## Description
Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range [-231, 231 - 1], then return 0.

Assume the environment does not allow you to store 64-bit integers (signed or unsigned).

 

Example 1:

Input: x = 123
Output: 321


Example 2:

Input: x = -123
Output: -321


Example 3:

Input: x = 120
Output: 21


 

Constraints:

-231 <= x <= 231 - 1

## Solution
# Reverse Integer Solution
## Problem Description
Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range [-231, 231 - 1], then return 0.

## Constraints
-231 <= x <= 231 - 1

## Solution
```python
def reverse(x: int) -> int:
    """
    Reverses a given 32-bit signed integer.
    
    Args:
        x (int): The input integer to be reversed.
    
    Returns:
        int: The reversed integer. If the result is out of range, returns 0.
    """

    # Define the minimum and maximum values for a 32-bit signed integer
    MIN_INT = -2**31
    MAX_INT = 2**31 - 1

    # Initialize an empty string to store the reversed digits
    reversed_str = ""

    # Convert the integer to a string
    x_str = str(x)

    # If the number is negative, remove the negative sign and add it back later if necessary
    if x < 0:
        sign = -1
        x_str = x_str[1:]  # Remove the negative sign
    else:
        sign = 1

    # Reverse the string of digits
    reversed_str = x_str[::-1]

    # Convert the reversed string back to an integer and apply the original sign
    result = sign * int(reversed_str)

    # Check if the result is within the valid range for a 32-bit signed integer
    if result < MIN_INT or result > MAX_INT:
        return 0
    else:
        return result

# Example usage
print(reverse(123))   # Output: 321
print(reverse(-123))  # Output: -321
print(reverse(120))   # Output: 21
```
## Time and Space Complexity
*   Time complexity: O(n), where n is the number of digits in the input integer. This is because we are reversing the string representation of the integer, which requires iterating over all the characters.
*   Space complexity: O(n), as well. We create a new string to store the reversed digits and then convert it back to an integer, both of which require additional space proportional to the number of digits in the input integer.

The code above is written in Python, but the algorithm can be implemented in other programming languages as well.